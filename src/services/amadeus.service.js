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
   * Données de démonstration dynamiques (utilisées quand l'API sandbox n'est pas encore provisionnée)
   */
  getMockFlightData(searchParams) {
    const { origin, destination, departureDate, returnDate } = searchParams;

    // Base prix selon le type de route (court/moyen/long courrier estimé)
    const knownLongHaul = ["JFK","LAX","ORD","DFW","MIA","SFO","YYZ","GRU","GIG","EZE","NRT","HND","ICN","PEK","PVG","HKG","SIN","BKK","DXB","DOH","AUH","SYD","MEL","JNB","CPT","LOS","NBO"];
    const isLongHaul = knownLongHaul.includes(destination) || knownLongHaul.includes(origin);
    const baseFare = isLongHaul ? 420 : 110;
    const spread = isLongHaul ? 600 : 200;
    const baseDuration = isLongHaul ? "PT9H30M" : "PT2H15M";

    const airlines = [
      { code: "AF", name: "Air France", nums: ["1234","1102","1448","1620"] },
      { code: "LH", name: "Lufthansa", nums: ["9876","9450","9102","9334"] },
      { code: "BA", name: "British Airways", nums: ["3021","3145","3267","3089"] },
      { code: "IB", name: "Iberia", nums: ["6234","6078","6512","6340"] },
      { code: "U2", name: "easyJet", nums: ["4501","4322","4788","4230"] },
      { code: "VY", name: "Vueling", nums: ["7120","7345","7089","7567"] },
      { code: "EK", name: "Emirates", nums: ["5011","5203","5447","5329"] },
      { code: "KL", name: "KLM", nums: ["8234","8056","8712","8490"] },
    ];

    const departureTimes = ["06:00","07:30","09:15","11:45","13:20","15:00","17:40","19:55"];
    const durationMinutes = isLongHaul
      ? [550, 580, 540, 600, 565, 590, 545, 610]
      : [90, 105, 120, 95, 110, 85, 130, 100];

    const addMinutes = (timeStr, date, minutes) => {
      const [h, m] = timeStr.split(":").map(Number);
      const total = h * 60 + m + minutes;
      const arrH = Math.floor(total / 60) % 24;
      const arrM = total % 60;
      const dayOffset = Math.floor((h * 60 + m + minutes) / 1440);
      const baseDate = new Date(date + "T00:00:00");
      baseDate.setDate(baseDate.getDate() + dayOffset);
      const arrDate = baseDate.toISOString().split("T")[0];
      return `${arrDate}T${String(arrH).padStart(2,"0")}:${String(arrM).padStart(2,"0")}:00`;
    };

    const toISO = (date, time) => `${date}T${time}:00`;

    const durationStr = (mins) => {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return m > 0 ? `PT${h}H${m}M` : `PT${h}H`;
    };

    return airlines.map((airline, i) => {
      const price = Math.round(baseFare + Math.random() * spread);
      const depTime = departureTimes[i];
      const durMins = durationMinutes[i];
      const arrTime = addMinutes(depTime, departureDate, durMins);
      const flightNum = airline.nums[0];

      let inbound = null;
      if (returnDate) {
        const retDepTime = departureTimes[(i + 3) % 8];
        const retArr = addMinutes(retDepTime, returnDate, durMins);
        inbound = {
          departure: { airport: destination, time: toISO(returnDate, retDepTime) },
          arrival: { airport: origin, time: retArr },
          duration: durationStr(durMins),
          stops: 0,
          segments: [{
            carrier: airline.code,
            flightNumber: airline.nums[1],
            aircraft: "320",
            departure: { airport: destination, time: toISO(returnDate, retDepTime) },
            arrival: { airport: origin, time: retArr },
            duration: durationStr(durMins),
          }],
        };
      }

      return {
        id: `mock-${i + 1}`,
        source: "amadeus-mock",
        price: { total: price, currency: "EUR", perAdult: price },
        outbound: {
          departure: { airport: origin, time: toISO(departureDate, depTime) },
          arrival: { airport: destination, time: arrTime },
          duration: durationStr(durMins),
          stops: 0,
          segments: [{
            carrier: airline.code,
            flightNumber: flightNum,
            aircraft: "320",
            departure: { airport: origin, time: toISO(departureDate, depTime) },
            arrival: { airport: destination, time: arrTime },
            duration: durationStr(durMins),
          }],
        },
        inbound,
        validatingAirlineCodes: [airline.code],
        travelerPricings: [],
      };
    });
  }
}

module.exports = new AmadeusService();
