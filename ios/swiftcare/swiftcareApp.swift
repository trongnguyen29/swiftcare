//
//  swiftcareApp.swift
//  swiftcare
//
//  Created by Trong Nguyen on 6/13/26.
//

import SwiftUI

@main
struct swiftcareApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(AuthService.shared)
        }
    }
}
