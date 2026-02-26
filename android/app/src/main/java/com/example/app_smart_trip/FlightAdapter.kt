package com.example.app_smart_trip

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.example.app_smart_trip.databinding.ItemFlightBinding

class FlightAdapter(
    private val context: Context,
    private val onFavoriteClick: (Flight) -> Unit
) : RecyclerView.Adapter<FlightAdapter.FlightViewHolder>() {

    private var flights: List<Flight> = emptyList()

    fun setData(data: List<Flight>) {
        flights = data
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): FlightViewHolder {
        val binding = ItemFlightBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return FlightViewHolder(binding)
    }

    override fun onBindViewHolder(holder: FlightViewHolder, position: Int) {
        holder.bind(flights[position])
    }

    override fun getItemCount() = flights.size

    inner class FlightViewHolder(private val b: ItemFlightBinding) : RecyclerView.ViewHolder(b.root) {

        fun bind(flight: Flight) {
            // Airline
            b.tvAirline.text = flight.airlineName ?: flight.airline

            // Price
            val currency = flight.currency ?: "EUR"
            b.tvPrice.text = "%.0f %s".format(flight.price, currency)

            // Times & airports
            b.tvDepartureTime.text = formatTime(flight.departureTime)
            b.tvArrivalTime.text   = formatTime(flight.arrivalTime)
            b.tvOrigin.text        = flight.origin
            b.tvDestination.text   = flight.destination

            // Duration
            b.tvDuration.text = flight.duration ?: ""

            // Stops
            b.tvStops.text = when (flight.stops) {
                0    -> "Direct"
                1    -> "1 escale"
                else -> "${flight.stops} escales"
            }
            b.tvStops.setTextColor(
                if (flight.stops == 0)
                    context.getColor(R.color.success_color)
                else
                    context.getColor(R.color.text_secondary)
            )

            // Favorite button
            b.btnFavorite.setOnClickListener {
                onFavoriteClick(flight)
                b.btnFavorite.text = "♥"
            }

            // Book button
            b.btnBook.setOnClickListener {
                val url = flight.bookingLink
                if (!url.isNullOrEmpty()) {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                    context.startActivity(intent)
                } else {
                    android.widget.Toast.makeText(context, "Lien de réservation non disponible", android.widget.Toast.LENGTH_SHORT).show()
                }
            }
        }

        /** Extrait HH:mm depuis une string ISO 8601 ou laisse tel quel */
        private fun formatTime(dt: String?): String {
            if (dt.isNullOrEmpty()) return "--:--"
            return try {
                if (dt.contains("T")) dt.substring(11, 16) else dt.takeLast(5)
            } catch (e: Exception) {
                dt.take(5)
            }
        }
    }
}
