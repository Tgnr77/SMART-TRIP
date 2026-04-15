const axios = require("axios");
const logger = require("../utils/logger");

/**
 * Service Amadeus Flight API
 * Documentation: https://developers.amadeus.com/self-service/category/flights
 */
class AmadeusService {
  constructor() {
    this.apiKey = process.env.AMADEUS_API_KEY;
    this.apiSecret = process.env.AMADEUS_API_SECRET;
    this.baseURL =
      process.env.AMADEUS_BASE_URL || "https://test.api.amadeus.com";
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Obtenir un token d'accès OAuth2
   */
  async getAccessToken() {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await axios.post(
        `${this.baseURL}/v1/security/oauth2/token`,
        new URLSearchParams({
          grant_type: "client_credentials",
          client_id: this.apiKey,
          client_secret: this.apiSecret,
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in - 300) * 1000;

      logger.info("Amadeus access token obtained");
      return this.accessToken;
    } catch (error) {
      logger.error(
        "Amadeus authentication failed:",
        error.response?.data || error.message
      );
      throw new Error("Failed to authenticate with Amadeus API");
    }
  }

  /**
   * Rechercher des offres de vols
   * @param {Object} searchParams - Paramètres de recherche
   * @returns {Promise<Array>} - Liste des offres de vols
   */
  async searchFlights(searchParams) {
    const {
      origin,
      destination,
      departureDate,
      returnDate,
      adults = 1,
      travelClass,
      cabinClass,
      nonStop = false,
      maxResults = 250,
    } = searchParams;

    // Résoudre la classe de voyage (le frontend Android envoie cabinClass)
    const resolvedClass = (travelClass || cabinClass || "ECONOMY").toUpperCase();

    logger.info("=== AMADEUS API REQUEST ===");
    logger.info(`Search: ${origin} -> ${destination} on ${departureDate}, class: ${resolvedClass}`);

    try {
      const token = await this.getAccessToken();

      const params = {
        originLocationCode: origin,
        destinationLocationCode: destination,
        departureDate,
        adults: Number(adults),
        travelClass: resolvedClass,
        max: maxResults,
      };

      // nonStop uniquement si explicitement true (évite rejets Amadeus avec false)
      if (nonStop === true || nonStop === "true") {
        params.nonStop = true;
      }

      if (returnDate) {
        params.returnDate = returnDate;
      }

      logger.info(`Params: ${JSON.stringify(params)}`);

      const response = await axios.get(
        `${this.baseURL}/v2/shopping/flight-offers`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params,
        }
      );

      const offers = response.data.data || [];
      logger.info(`Amadeus: found ${offers.length} offers`);
      return this.formatFlightOffers(offers);
    } catch (error) {
      logger.error("=== AMADEUS API ERROR ===");
      logger.error(`Status: ${error.response?.status}`);
      logger.error(`Data: ${JSON.stringify(error.response?.data)}`);
      logger.error(`Message: ${error.message}`);
      logger.warn("Falling back to demo data");
      return this.getMockFlightData(searchParams);
    }
  }

  /**
   * Obtenir les prédictions de prix
   * @param {Object} params - Paramètres de recherche
   * @returns {Promise<Object>} - Prédictions de prix
   */
  async getPricePrediction(params) {
    const { origin, destination, departureDate } = params;

    try {
      const token = await this.getAccessToken();

      const response = await axios.get(
        `${this.baseURL}/v1/analytics/itinerary-price-metrics`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: {
            originIataCode: origin,
            destinationIataCode: destination,
            departureDate,
            currencyCode: "EUR",
          },
        }
      );

      return {
        currentPrice: response.data.data[0]?.priceMetrics[0]?.quartileRanking,
        prediction: response.data.data[0]?.priceMetrics[0]?.median,
        trend: this.analyzePriceTrend(response.data.data[0]?.priceMetrics),
        recommendation: this.getBookingRecommendation(response.data.data[0]),
      };
    } catch (error) {
      logger.error(
        "Amadeus price prediction error:",
        error.response?.data || error.message
      );
      return null;
    }
  }

  /**
   * Formater les offres de vols au format standardisé
   */
  formatFlightOffers(offers) {
    return offers.map((offer) => {
      const outbound = offer.itineraries[0];
      const inbound = offer.itineraries[1];

      return {
        id: offer.id,
        source: "amadeus",
        price: {
          total: parseFloat(offer.price.total),
          currency: offer.price.currency,
          perAdult:
            parseFloat(offer.price.total) / offer.travelerPricings.length,
        },
        outbound: {
          departure: {
            airport: outbound.segments[0].departure.iataCode,
            time: outbound.segments[0].departure.at,
          },
          arrival: {
            airport:
              outbound.segments[outbound.segments.length - 1].arrival.iataCode,
            time: outbound.segments[outbound.segments.length - 1].arrival.at,
          },
          duration: outbound.duration,
          stops: outbound.segments.length - 1,
          segments: outbound.segments.map((seg) => ({
            carrier: seg.carrierCode,
            flightNumber: seg.number,
            aircraft: seg.aircraft?.code,
            departure: {
              airport: seg.departure.iataCode,
              time: seg.departure.at,
            },
            arrival: { airport: seg.arrival.iataCode, time: seg.arrival.at },
            duration: seg.duration,
          })),
        },
        inbound: inbound
          ? {
              departure: {
                airport: inbound.segments[0].departure.iataCode,
                time: inbound.segments[0].departure.at,
              },
              arrival: {
                airport:
                  inbound.segments[inbound.segments.length - 1].arrival
                    .iataCode,
                time: inbound.segments[inbound.segments.length - 1].arrival.at,
              },
              duration: inbound.duration,
              stops: inbound.segments.length - 1,
              segments: inbound.segments.map((seg) => ({
                carrier: seg.carrierCode,
                flightNumber: seg.number,
                aircraft: seg.aircraft?.code,
                departure: {
                  airport: seg.departure.iataCode,
                  time: seg.departure.at,
                },
                arrival: {
                  airport: seg.arrival.iataCode,
                  time: seg.arrival.at,
                },
                duration: seg.duration,
              })),
            }
          : null,
        validatingAirlineCodes: offer.validatingAirlineCodes,
        travelerPricings: offer.travelerPricings,
      };
    });
  }

  /**
   * Analyser la tendance des prix
   */
  analyzePriceTrend(priceMetrics) {
    if (!priceMetrics || priceMetrics.length === 0) return "stable";

    // Logique simplifiée - à améliorer avec ML
    const metric = priceMetrics[0];
    const quartile = metric.quartileRanking;

    if (quartile === "LOW") return "decreasing";
    if (quartile === "HIGH") return "increasing";
    return "stable";
  }

  /**
   * Recommandation d'achat
   */
  getBookingRecommendation(data) {
    if (!data) return { action: "wait", confidence: "low" };

    const quartile = data.priceMetrics?.[0]?.quartileRanking;

    if (quartile === "LOW" || quartile === "TYPICAL") {
      return {
        action: "book_now",
        confidence: "high",
        reason: "Prix actuellement bas",
      };
    } else if (quartile === "HIGH") {
      return {
        action: "wait",
        confidence: "medium",
        reason: "Prix élevés, attendre une baisse",
      };
    }

    return {
      action: "monitor",
      confidence: "medium",
      reason: "Surveiller les prix",
    };
  }

  /**
   * Données de test (quand API non configurée)
   */
  getMockFlightData(searchParams) {
    const basePrice = 150 + Math.random() * 500;

    return [
      {
        id: "mock-1",
        source: "amadeus-mock",
        price: {
          total: basePrice,
          currency: "EUR",
          perAdult: basePrice,
        },
        outbound: {
          departure: {
            airport: searchParams.origin,
            time: `${searchParams.departureDate}T08:00:00`,
          },
          arrival: {
            airport: searchParams.destination,
            time: `${searchParams.departureDate}T12:00:00`,
          },
          duration: "PT4H",
          stops: 0,
          segments: [
            {
              carrier: "AF",
              flightNumber: "1234",
              aircraft: "320",
              departure: {
                airport: searchParams.origin,
                time: `${searchParams.departureDate}T08:00:00`,
              },
              arrival: {
                airport: searchParams.destination,
                time: `${searchParams.departureDate}T12:00:00`,
              },
              duration: "PT4H",
            },
          ],
        },
        inbound: searchParams.returnDate
          ? {
              departure: {
                airport: searchParams.destination,
                time: `${searchParams.returnDate}T14:00:00`,
              },
              arrival: {
                airport: searchParams.origin,
                time: `${searchParams.returnDate}T18:00:00`,
              },
              duration: "PT4H",
              stops: 0,
              segments: [
                {
                  carrier: "AF",
                  flightNumber: "5678",
                  aircraft: "320",
                  departure: {
                    airport: searchParams.destination,
                    time: `${searchParams.returnDate}T14:00:00`,
                  },
                  arrival: {
                    airport: searchParams.origin,
                    time: `${searchParams.returnDate}T18:00:00`,
                  },
                  duration: "PT4H",
                },
              ],
            }
          : null,
        validatingAirlineCodes: ["AF"],
        travelerPricings: [],
      },
      {
        id: "mock-2",
        source: "amadeus-mock",
        price: {
          total: basePrice + 80,
          currency: "EUR",
          perAdult: basePrice + 80,
        },
        outbound: {
          departure: {
            airport: searchParams.origin,
            time: `${searchParams.departureDate}T06:30:00`,
          },
          arrival: {
            airport: searchParams.destination,
            time: `${searchParams.departureDate}T10:45:00`,
          },
          duration: "PT4H15M",
          stops: 0,
          segments: [
            {
              carrier: "LH",
              flightNumber: "9876",
              aircraft: "321",
              departure: {
                airport: searchParams.origin,
                time: `${searchParams.departureDate}T06:30:00`,
              },
              arrival: {
                airport: searchParams.destination,
                time: `${searchParams.departureDate}T10:45:00`,
              },
              duration: "PT4H15M",
            },
          ],
        },
        inbound: searchParams.returnDate
          ? {
              departure: {
                airport: searchParams.destination,
                time: `${searchParams.returnDate}T16:00:00`,
              },
              arrival: {
                airport: searchParams.origin,
                time: `${searchParams.returnDate}T20:15:00`,
              },
              duration: "PT4H15M",
              stops: 0,
              segments: [
                {
                  carrier: "LH",
                  flightNumber: "5432",
                  aircraft: "321",
                  departure: {
                    airport: searchParams.destination,
                    time: `${searchParams.returnDate}T16:00:00`,
                  },
                  arrival: {
                    airport: searchParams.origin,
                    time: `${searchParams.returnDate}T20:15:00`,
                  },
                  duration: "PT4H15M",
                },
              ],
            }
          : null,
        validatingAirlineCodes: ["LH"],
        travelerPricings: [],
      },
    ];
  }
}

module.exports = new AmadeusService();
