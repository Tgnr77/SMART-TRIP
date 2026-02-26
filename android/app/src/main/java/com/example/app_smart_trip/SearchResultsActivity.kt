package com.example.app_smart_trip

import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.example.app_smart_trip.databinding.ActivitySearchResultsBinding
import kotlinx.coroutines.launch

class SearchResultsActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySearchResultsBinding
    private lateinit var adapter: FlightAdapter
    private var allFlights: List<Flight> = emptyList()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySearchResultsBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupToolbar()
        setupRecyclerView()
        setupSortChips()
        loadFlights()
    }

    private fun setupToolbar() {
        setSupportActionBar(binding.toolbar)
        val origin = intent.getStringExtra("origin") ?: ""
        val dest   = intent.getStringExtra("destination") ?: ""
        supportActionBar?.title = "$origin → $dest"
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        binding.toolbar.setNavigationOnClickListener { onBackPressedDispatcher.onBackPressed() }
    }

    private fun setupRecyclerView() {
        adapter = FlightAdapter(this) { flight ->
            addToFavorites(flight)
        }
        binding.rvFlights.layoutManager = LinearLayoutManager(this)
        binding.rvFlights.adapter = adapter
    }

    private fun setupSortChips() {
        binding.chipGroupSort.setOnCheckedStateChangeListener { _, checkedIds ->
            if (checkedIds.isEmpty()) return@setOnCheckedStateChangeListener
            val sorted = when (checkedIds.first()) {
                R.id.chip_price    -> allFlights.sortedBy { it.price }
                R.id.chip_duration -> allFlights.sortedBy { it.duration ?: "" }
                else               -> allFlights  // "best" = default order from API
            }
            adapter.setData(sorted)
        }
    }

    private fun loadFlights() {
        val origin       = intent.getStringExtra("origin") ?: return
        val destination  = intent.getStringExtra("destination") ?: return
        val departure    = intent.getStringExtra("departureDate") ?: return
        val returnDate   = intent.getStringExtra("returnDate")
        val passengers   = intent.getIntExtra("passengers", 1)
        val cabinClass   = intent.getStringExtra("cabinClass") ?: "economy"

        setLoading(true)

        lifecycleScope.launch {
            try {
                val token = AuthManager.getBearerToken(this@SearchResultsActivity)
                val resp  = RetrofitClient.api.searchFlights(
                    token, origin, destination, departure, returnDate, passengers, cabinClass
                )
                val body = resp.body()

                if (resp.isSuccessful && body?.success == true) {
                    allFlights = body.flights
                    if (allFlights.isEmpty()) {
                        showError("Aucun vol trouvé pour cette recherche.")
                    } else {
                        adapter.setData(allFlights)
                        binding.rvFlights.visibility = View.VISIBLE
                    }
                } else {
                    showError(body?.message ?: "Erreur lors de la recherche de vols")
                }
            } catch (e: Exception) {
                showError("Erreur réseau : ${e.message}")
            } finally {
                setLoading(false)
            }
        }
    }

    private fun addToFavorites(flight: Flight) {
        if (!AuthManager.isLoggedIn(this)) {
            android.widget.Toast.makeText(this, "Connectez-vous pour ajouter des favoris", android.widget.Toast.LENGTH_SHORT).show()
            return
        }

        lifecycleScope.launch {
            try {
                val token = AuthManager.getBearerToken(this@SearchResultsActivity)
                RetrofitClient.api.addFavorite(token, AddFavoriteRequest(flight))
                android.widget.Toast.makeText(this@SearchResultsActivity, "Ajouté aux favoris !", android.widget.Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                android.widget.Toast.makeText(this@SearchResultsActivity, "Erreur : ${e.message}", android.widget.Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun setLoading(loading: Boolean) {
        binding.layoutLoading.visibility = if (loading) View.VISIBLE else View.GONE
    }

    private fun showError(msg: String) {
        binding.tvError.text = msg
        binding.tvError.visibility = View.VISIBLE
        binding.rvFlights.visibility = View.GONE
    }
}
