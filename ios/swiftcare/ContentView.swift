//
//  ContentView.swift
//  swiftcare
//
//  Created by Trong Nguyen on 6/13/26.
//

import SwiftUI

struct ContentView: View {
    @State private var selectedPatient: Patient?
    
    var body: some View {
        NavigationSplitView {
            PatientListView(selectedPatient: $selectedPatient)
                .navigationTitle("SwiftCare")
        } detail: {
            if let patient = selectedPatient {
                PatientDetailView(patient: patient)
            } else {
                VStack(spacing: 16) {
                    Image(systemName: "cross.case.fill")
                        .font(.system(size: 48))
                        .foregroundColor(.teal)
                    Text("Select a patient")
                        .font(.title2.bold())
                    Text("Choose a patient from the sidebar to view their EHR summary and start recording a visit.")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 40)
                }
            }
        }
    }
}

#Preview {
    ContentView()
}
