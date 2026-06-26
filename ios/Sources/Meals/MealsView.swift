import SwiftUI

private let MEAL_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"]
private func cap(_ s: String) -> String { s.isEmpty ? s : s.prefix(1).uppercased() + s.dropFirst() }
private func mealTypeLabel(_ t: String) -> String { t == "afternoon_snack" ? "PM Snack" : cap(t) }

@MainActor
final class MealsViewModel: ObservableObject {
    @Published var plans: [MealPlanItem] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do { plans = try await APIClient.shared.getMealPlans() }
        catch { errorMessage = (error as? APIError)?.errorDescription ?? "Couldn't load meal plans." }
    }
}

struct MealsView: View {
    @StateObject private var vm = MealsViewModel()

    var body: some View {
        List {
            if vm.plans.isEmpty && !vm.isLoading {
                Text("No meal plans yet.").font(.cfSubheadline).foregroundColor(.cfTextSecondary)
            }
            ForEach(vm.plans) { p in
                NavigationLink(destination: MealPlanDetailView(planId: p.id, title: p.classroomName)) {
                    VStack(alignment: .leading, spacing: 3) {
                        HStack {
                            Text(p.classroomName).font(.cfSubheadline.weight(.semibold)).foregroundColor(.cfTextPrimary)
                            Spacer()
                            Text(cap(p.status)).font(.system(size: 10, weight: .bold))
                                .padding(.horizontal, 8).padding(.vertical, 2)
                                .background((p.status == "approved" || p.status == "served" ? Color.cfAttendance : Color.cfTextSecondary).opacity(0.15))
                                .foregroundColor(p.status == "approved" || p.status == "served" ? .cfAttendance : .cfTextSecondary)
                                .clipShape(Capsule())
                        }
                        if let w = p.weekStartDate { Text("Week of \(w)").font(.cfCaption).foregroundColor(.cfTextSecondary) }
                    }
                    .padding(.vertical, 2)
                }
            }
        }
        .navigationTitle("Meal Plans")
        .navigationBarTitleDisplayMode(.inline)
        .task { await vm.load() }
        .overlay { if vm.isLoading { ProgressView() } }
        .alert("Meal Plans", isPresented: .constant(vm.errorMessage != nil)) {
            Button("OK") { vm.errorMessage = nil }
        } message: { Text(vm.errorMessage ?? "") }
    }
}

@MainActor
final class MealPlanDetailViewModel: ObservableObject {
    @Published var items: [MealItemRow] = []
    @Published var isLoading = false
    func load(_ id: String) async {
        isLoading = true
        defer { isLoading = false }
        items = (try? await APIClient.shared.getMealItems(planId: id)) ?? []
    }
}

struct MealPlanDetailView: View {
    let planId: String
    let title: String
    @StateObject private var vm = MealPlanDetailViewModel()

    var body: some View {
        List {
            ForEach(MEAL_DAYS, id: \.self) { day in
                let meals = vm.items.filter { $0.dayOfWeek == day }
                Section(cap(day)) {
                    if meals.isEmpty {
                        Text("No meals planned").font(.cfCaption).foregroundColor(.cfTextSecondary)
                    }
                    ForEach(meals) { m in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(mealTypeLabel(m.mealType)).font(.cfCaption2.weight(.bold)).foregroundColor(.cfPrimary)
                            Text(m.description).font(.cfSubheadline).foregroundColor(.cfTextPrimary)
                        }
                        .padding(.vertical, 2)
                    }
                }
            }
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .task { await vm.load(planId) }
    }
}
