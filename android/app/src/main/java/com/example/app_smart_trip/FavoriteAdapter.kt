package com.example.app_smart_trip

import android.content.Context
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.example.app_smart_trip.databinding.ItemFavoriteBinding

class FavoriteAdapter(
    private val context: Context,
    private val onRemoveClick: (String) -> Unit
) : RecyclerView.Adapter<FavoriteAdapter.FavoriteViewHolder>() {

    private val favorites: MutableList<FavoriteItem> = mutableListOf()

    fun setData(data: List<FavoriteItem>) {
        favorites.clear()
        favorites.addAll(data)
        notifyDataSetChanged()
    }

    fun removeItem(favoriteId: String) {
        val index = favorites.indexOfFirst { it.id == favoriteId }
        if (index >= 0) {
            favorites.removeAt(index)
            notifyItemRemoved(index)
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): FavoriteViewHolder {
        val binding = ItemFavoriteBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return FavoriteViewHolder(binding)
    }

    override fun onBindViewHolder(holder: FavoriteViewHolder, position: Int) {
        holder.bind(favorites[position])
    }

    override fun getItemCount() = favorites.size

    inner class FavoriteViewHolder(private val b: ItemFavoriteBinding) : RecyclerView.ViewHolder(b.root) {

        fun bind(item: FavoriteItem) {
            val flight = item.flightData

            if (flight != null) {
                b.tvRoute.text   = "${flight.origin} → ${flight.destination}"
                b.tvAirline.text = flight.airlineName ?: flight.airline
                val currency = flight.currency ?: "EUR"
                b.tvPrice.text   = "%.0f %s".format(flight.price, currency)
            } else {
                b.tvRoute.text   = "Vol inconnu"
                b.tvAirline.text = ""
                b.tvPrice.text   = ""
            }

            b.btnRemove.setOnClickListener {
                onRemoveClick(item.id)
            }
        }
    }
}
