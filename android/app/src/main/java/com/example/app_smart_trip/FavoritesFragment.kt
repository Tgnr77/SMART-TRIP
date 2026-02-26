package com.example.app_smart_trip

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.example.app_smart_trip.databinding.FragmentFavoritesBinding
import kotlinx.coroutines.launch

class FavoritesFragment : Fragment() {

    private var _binding: FragmentFavoritesBinding? = null
    private val binding get() = _binding!!

    private lateinit var adapter: FavoriteAdapter

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentFavoritesBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupRecyclerView()

        if (AuthManager.isLoggedIn(requireContext())) {
            loadFavorites()
        } else {
            binding.tvEmpty.text = "Connectez-vous pour voir vos favoris"
            binding.tvEmpty.visibility = View.VISIBLE
        }
    }

    private fun setupRecyclerView() {
        adapter = FavoriteAdapter(requireContext()) { favoriteId ->
            removeFavorite(favoriteId)
        }
        binding.rvFavorites.layoutManager = LinearLayoutManager(requireContext())
        binding.rvFavorites.adapter = adapter
    }

    private fun loadFavorites() {
        binding.progressBar.visibility = View.VISIBLE

        lifecycleScope.launch {
            try {
                val token = AuthManager.getBearerToken(requireContext())
                val resp  = RetrofitClient.api.getFavorites(token)
                val body  = resp.body()

                if (resp.isSuccessful && body?.success == true) {
                    val favs = body.favorites
                    if (favs.isEmpty()) {
                        binding.tvEmpty.visibility = View.VISIBLE
                    } else {
                        adapter.setData(favs)
                    }
                } else {
                    binding.tvEmpty.text = "Erreur lors du chargement"
                    binding.tvEmpty.visibility = View.VISIBLE
                }
            } catch (e: Exception) {
                binding.tvEmpty.text = "Erreur réseau : ${e.message}"
                binding.tvEmpty.visibility = View.VISIBLE
            } finally {
                binding.progressBar.visibility = View.GONE
            }
        }
    }

    private fun removeFavorite(favoriteId: String) {
        lifecycleScope.launch {
            try {
                val token = AuthManager.getBearerToken(requireContext())
                RetrofitClient.api.removeFavorite(token, favoriteId)
                adapter.removeItem(favoriteId)
                if (adapter.itemCount == 0) {
                    binding.tvEmpty.visibility = View.VISIBLE
                }
            } catch (e: Exception) {
                android.widget.Toast.makeText(requireContext(), "Erreur : ${e.message}", android.widget.Toast.LENGTH_SHORT).show()
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
