package com.example.app_smart_trip

import android.app.DatePickerDialog
import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import androidx.fragment.app.Fragment
import com.example.app_smart_trip.databinding.FragmentSearchBinding
import java.util.Calendar

class SearchFragment : Fragment() {

    private var _binding: FragmentSearchBinding? = null
    private val binding get() = _binding!!

    private val cabinClasses = listOf("economy", "premium_economy", "business", "first")

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentSearchBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupCabinClassDropdown()
        setupDatePickers()
        setupSearchButton()
    }

    private fun setupCabinClassDropdown() {
        val adapter = ArrayAdapter(requireContext(), android.R.layout.simple_dropdown_item_1line, cabinClasses)
        binding.etCabinClass.setAdapter(adapter)
    }

    private fun setupDatePickers() {
        binding.etDepartureDate.setOnClickListener { showDatePicker { date -> binding.etDepartureDate.setText(date) } }
        binding.etReturnDate.setOnClickListener    { showDatePicker { date -> binding.etReturnDate.setText(date) } }
    }

    private fun showDatePicker(onDateSelected: (String) -> Unit) {
        val cal = Calendar.getInstance()
        DatePickerDialog(requireContext(), { _, year, month, day ->
            val date = "%04d-%02d-%02d".format(year, month + 1, day)
            onDateSelected(date)
        }, cal.get(Calendar.YEAR), cal.get(Calendar.MONTH), cal.get(Calendar.DAY_OF_MONTH))
            .show()
    }

    private fun setupSearchButton() {
        binding.btnSearch.setOnClickListener {
            val origin      = binding.etOrigin.text?.toString()?.trim()?.uppercase() ?: ""
            val destination = binding.etDestination.text?.toString()?.trim()?.uppercase() ?: ""
            val departure   = binding.etDepartureDate.text?.toString()?.trim() ?: ""
            val returnDate  = binding.etReturnDate.text?.toString()?.trim() ?: ""
            val passengers  = binding.etPassengers.text?.toString()?.toIntOrNull() ?: 1
            val cabinClass  = binding.etCabinClass.text?.toString() ?: "economy"

            if (origin.isEmpty() || destination.isEmpty() || departure.isEmpty()) {
                android.widget.Toast.makeText(requireContext(), "Remplissez origine, destination et date.", android.widget.Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            val intent = Intent(requireContext(), SearchResultsActivity::class.java).apply {
                putExtra("origin",         origin)
                putExtra("destination",    destination)
                putExtra("departureDate",  departure)
                putExtra("returnDate",     returnDate.ifEmpty { null })
                putExtra("passengers",     passengers)
                putExtra("cabinClass",     cabinClass)
            }
            startActivity(intent)
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
