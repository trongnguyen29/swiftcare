import SwiftUI

/// Patient-less quick recording. The resulting visit is saved as unassigned
/// and can be linked to a patient later from the Home tab.
struct QuickRecordView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationView {
            VisitView(patient: nil, startSignal: 1)
                .navigationTitle("Quick Record")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Button("Done") { dismiss() }
                    }
                }
        }
    }
}
