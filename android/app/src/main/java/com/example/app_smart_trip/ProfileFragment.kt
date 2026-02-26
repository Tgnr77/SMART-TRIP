package com.example.app_smart_trip

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import com.example.app_smart_trip.databinding.FragmentProfileBinding

class ProfileFragment : Fragment() {

    private var _binding: FragmentProfileBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentProfileBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val user = AuthManager.getUser(requireContext())

        if (user != null) {
            showLoggedIn(user)
        } else {
            showLoggedOut()
        }
    }

    private fun showLoggedIn(user: User) {
        binding.tvFullName.text   = "${user.firstName} ${user.lastName}"
        binding.tvEmail.text      = user.email
        binding.tvAvatar.text     = user.firstName.firstOrNull()?.uppercase() ?: "?"

        binding.btnLogout.visibility  = View.VISIBLE
        binding.tvFullName.visibility = View.VISIBLE
        binding.tvEmail.visibility    = View.VISIBLE
        binding.tvAvatar.visibility   = View.VISIBLE

        binding.btnLogout.setOnClickListener {
            AuthManager.logout(requireContext())
            startActivity(Intent(requireContext(), LandingActivity::class.java))
            requireActivity().finishAffinity()
        }
    }

    private fun showLoggedOut() {
        binding.tvAvatar.visibility   = View.GONE
        binding.tvFullName.visibility = View.GONE
        binding.tvEmail.visibility    = View.GONE
        binding.btnLogout.visibility  = View.GONE

        binding.tvNotLogged.visibility = View.VISIBLE
        binding.btnGoLogin.visibility  = View.VISIBLE

        binding.btnGoLogin.setOnClickListener {
            startActivity(Intent(requireContext(), LoginActivity::class.java))
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
