import SwiftUI

// MARK: - Nutrition Forms Hub

struct NutritionFormsView: View {
    @State private var selectedFormType = 0
    private let formTypes = ["Preferences", "Infant Formula", "Medical Statement"]

    var body: some View {
        VStack(spacing: 0) {
            Picker("Form Type", selection: $selectedFormType) {
                ForEach(formTypes.indices, id: \.self) { i in
                    Text(formTypes[i]).tag(i)
                }
            }
            .pickerStyle(.segmented)
            .padding()

            TabView(selection: $selectedFormType) {
                NutritionalPreferencesListView().tag(0)
                InfantFormulaListView().tag(1)
                MedicalStatementListView().tag(2)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
        }
        .navigationTitle("CACFP / Nutrition")
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Nutritional Preferences

struct NutritionalPreferencesListView: View {
    @StateObject private var viewModel = NutritionPreferencesViewModel()
    @State private var showNewForm = false

    var body: some View {
        List {
            if viewModel.forms.isEmpty && !viewModel.isLoading {
                VStack(spacing: 16) {
                    Image(systemName: "fork.knife")
                        .font(.largeTitle)
                        .foregroundColor(.secondary)
                    Text("No Preference Forms")
                        .font(.headline)
                    Text("Document nutritional preferences for each child enrolled in CACFP.")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                    Button("New Form") { showNewForm = true }
                        .buttonStyle(.borderedProminent)
                }
                .frame(maxWidth: .infinity)
                .padding()
                .listRowBackground(Color.clear)
            } else {
                ForEach(viewModel.forms) { form in
                    NavigationLink(destination: NutritionalPreferenceDetailView(form: form)) {
                        NutritionFormRow(
                            childName: form.childName,
                            classroom: form.classroom,
                            date: form.completedDate,
                            parentName: form.parentName
                        )
                    }
                }
            }
        }
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button(action: { showNewForm = true }) { Image(systemName: "plus") }
            }
        }
        .sheet(isPresented: $showNewForm) {
            NutritionalPreferenceFormSheet { _ in
                Task { await viewModel.load() }
            }
        }
        .task { await viewModel.load() }
        .refreshable { await viewModel.load() }
        .overlay { if viewModel.isLoading { ProgressView() } }
    }
}

struct NutritionFormRow: View {
    let childName: String
    let classroom: String
    let date: Date
    let parentName: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(childName)
                .font(.subheadline.weight(.medium))
            HStack(spacing: 8) {
                Text(classroom)
                Text("·")
                Text(parentName)
            }
            .font(.caption)
            .foregroundColor(.secondary)
            Text(date, style: .date)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 2)
    }
}

struct NutritionalPreferenceDetailView: View {
    let form: NutritionalPreferenceForm

    var groupedPreferences: [(String, [FoodPreferenceEntry])] {
        let grouped = Dictionary(grouping: form.preferences, by: \.foodGroup)
        return grouped.sorted { $0.key < $1.key }
    }

    var body: some View {
        List {
            Section("Child Information") {
                LabeledContent("Child", value: form.childName)
                LabeledContent("Classroom", value: form.classroom)
                LabeledContent("Completed By", value: form.parentName)
                LabeledContent("Date") { Text(form.completedDate, style: .date) }
            }
            ForEach(groupedPreferences, id: \.0) { group, items in
                Section(group) {
                    ForEach(items) { entry in
                        HStack {
                            Text(entry.item)
                                .font(.subheadline)
                            Spacer()
                            Text(entry.preference.rawValue)
                                .font(.caption.weight(.semibold))
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(entry.preference.color.opacity(0.12))
                                .foregroundColor(entry.preference.color)
                                .clipShape(Capsule())
                        }
                    }
                }
            }
            if !form.notes.isEmpty {
                Section("Notes") { Text(form.notes) }
            }
        }
        .navigationTitle("Nutritional Preferences")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct NutritionalPreferenceFormSheet: View {
    let onSave: (NutritionalPreferenceForm) -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var childName = ""
    @State private var classroom = ""
    @State private var parentName = ""
    @State private var notes = ""
    @State private var preferences: [(group: String, item: String, preference: FoodPreferenceEntry.FoodPreference)] = {
        let foods: [(String, String)] = [
            ("Fruits", "Apples"), ("Fruits", "Bananas"), ("Fruits", "Oranges"),
            ("Vegetables", "Broccoli"), ("Vegetables", "Carrots"), ("Vegetables", "Peas"),
            ("Proteins", "Chicken"), ("Proteins", "Beef"), ("Proteins", "Beans"),
            ("Grains", "Rice"), ("Grains", "Pasta"), ("Grains", "Bread"),
            ("Dairy", "Milk"), ("Dairy", "Cheese"), ("Dairy", "Yogurt")
        ]
        return foods.map { (group: $0.0, item: $0.1, preference: .likes) }
    }()

    var body: some View {
        NavigationStack {
            Form {
                Section("Child Information") {
                    TextField("Child Name", text: $childName)
                    TextField("Classroom", text: $classroom)
                    TextField("Parent/Guardian Name", text: $parentName)
                }
                ForEach(preferences.indices, id: \.self) { i in
                    if i == 0 || preferences[i].group != preferences[i-1].group {
                        Section(preferences[i].group) {
                            foodPreferencePicker(index: i)
                            let sameGroup = preferences.indices.filter {
                                preferences[$0].group == preferences[i].group && $0 > i
                            }
                            ForEach(sameGroup, id: \.self) { j in
                                foodPreferencePicker(index: j)
                            }
                        }
                    }
                }
                Section("Additional Notes") {
                    TextEditor(text: $notes).frame(minHeight: 80)
                }
            }
            .navigationTitle("Nutritional Preference Form")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(childName.isEmpty)
                }
            }
        }
    }

    @ViewBuilder
    private func foodPreferencePicker(index: Int) -> some View {
        HStack {
            Text(preferences[index].item)
                .font(.subheadline)
            Spacer()
            Picker("", selection: $preferences[index].preference) {
                ForEach(FoodPreferenceEntry.FoodPreference.allCases, id: \.self) { pref in
                    Text(pref.rawValue).tag(pref)
                }
            }
            .labelsHidden()
            .pickerStyle(.menu)
        }
    }

    private func save() {
        let form = NutritionalPreferenceForm(
            id: UUID().uuidString,
            childId: UUID().uuidString,
            childName: childName,
            classroom: classroom,
            completedDate: Date(),
            parentName: parentName,
            preferences: preferences.map { p in
                FoodPreferenceEntry(id: UUID().uuidString, foodGroup: p.group, item: p.item, preference: p.preference)
            },
            notes: notes
        )
        onSave(form)
        dismiss()
    }
}

@MainActor
class NutritionPreferencesViewModel: ObservableObject {
    @Published var forms: [NutritionalPreferenceForm] = []
    @Published var isLoading = false

    func load() async {
        isLoading = true
        do {
            forms = try await APIClient.shared.getNutritionForms(childId: "")
        } catch {
            #if DEBUG
            forms = MockData.nutritionPreferenceForms
            #endif
        }
        isLoading = false
    }
}

// MARK: - CACFP Infant Formula

struct InfantFormulaListView: View {
    @StateObject private var viewModel = InfantFormulaViewModel()
    @State private var showNewForm = false

    var body: some View {
        List {
            if viewModel.forms.isEmpty && !viewModel.isLoading {
                VStack(spacing: 16) {
                    Image(systemName: "drop.fill")
                        .font(.largeTitle)
                        .foregroundColor(.secondary)
                    Text("No Infant Formula Forms")
                        .font(.headline)
                    Text("Document formula type and feeding instructions for infants in care.")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                    Button("New Form") { showNewForm = true }
                        .buttonStyle(.borderedProminent)
                }
                .frame(maxWidth: .infinity)
                .padding()
                .listRowBackground(Color.clear)
            } else {
                ForEach(viewModel.forms) { form in
                    NavigationLink(destination: InfantFormulaDetailView(form: form)) {
                        NutritionFormRow(
                            childName: form.childName,
                            classroom: form.classroom,
                            date: form.completedDate,
                            parentName: form.parentName
                        )
                    }
                }
            }
        }
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button(action: { showNewForm = true }) { Image(systemName: "plus") }
            }
        }
        .sheet(isPresented: $showNewForm) {
            InfantFormulaFormSheet { _ in
                Task { await viewModel.load() }
            }
        }
        .task { await viewModel.load() }
        .refreshable { await viewModel.load() }
        .overlay { if viewModel.isLoading { ProgressView() } }
    }
}

struct InfantFormulaDetailView: View {
    let form: CACFPInfantFormulaForm

    var body: some View {
        List {
            Section("Child Information") {
                LabeledContent("Child", value: form.childName)
                LabeledContent("Classroom", value: form.classroom)
                LabeledContent("Completed By", value: form.parentName)
                LabeledContent("Date") { Text(form.completedDate, style: .date) }
            }
            Section("Formula") {
                LabeledContent("Brand", value: form.formulaBrand)
                LabeledContent("Type", value: form.formulaType)
            }
            Section("Preparation") {
                Text(form.preparationInstructions)
            }
            Section("Feeding Schedule") {
                Text(form.feedingSchedule)
            }
            if !form.notes.isEmpty {
                Section("Notes") { Text(form.notes) }
            }
        }
        .navigationTitle("Infant Formula")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct InfantFormulaFormSheet: View {
    let onSave: (CACFPInfantFormulaForm) -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var childName = ""
    @State private var classroom = ""
    @State private var parentName = ""
    @State private var formulaBrand = ""
    @State private var formulaType = ""
    @State private var preparationInstructions = ""
    @State private var feedingSchedule = ""
    @State private var notes = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Child Information") {
                    TextField("Child Name", text: $childName)
                    TextField("Classroom", text: $classroom)
                    TextField("Parent/Guardian Name", text: $parentName)
                }
                Section("Formula Details") {
                    TextField("Brand (e.g., Enfamil, Similac)", text: $formulaBrand)
                    TextField("Type (e.g., Infant, Sensitive)", text: $formulaType)
                }
                Section("Preparation Instructions") {
                    TextEditor(text: $preparationInstructions)
                        .frame(minHeight: 80)
                        .overlay(alignment: .topLeading) {
                            if preparationInstructions.isEmpty {
                                Text("How to prepare formula…")
                                    .foregroundColor(.secondary)
                                    .padding(.top, 8).padding(.leading, 4)
                                    .allowsHitTesting(false)
                            }
                        }
                }
                Section("Feeding Schedule") {
                    TextEditor(text: $feedingSchedule)
                        .frame(minHeight: 60)
                        .overlay(alignment: .topLeading) {
                            if feedingSchedule.isEmpty {
                                Text("How often / how much…")
                                    .foregroundColor(.secondary)
                                    .padding(.top, 8).padding(.leading, 4)
                                    .allowsHitTesting(false)
                            }
                        }
                }
                Section("Notes") {
                    TextEditor(text: $notes).frame(minHeight: 60)
                }
            }
            .navigationTitle("Infant Formula Form")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }.disabled(childName.isEmpty || formulaBrand.isEmpty)
                }
            }
        }
    }

    private func save() {
        let form = CACFPInfantFormulaForm(
            id: UUID().uuidString, childId: UUID().uuidString,
            childName: childName, classroom: classroom,
            completedDate: Date(), parentName: parentName,
            formulaBrand: formulaBrand, formulaType: formulaType,
            preparationInstructions: preparationInstructions,
            feedingSchedule: feedingSchedule, notes: notes
        )
        onSave(form)
        dismiss()
    }
}

@MainActor
class InfantFormulaViewModel: ObservableObject {
    @Published var forms: [CACFPInfantFormulaForm] = []
    @Published var isLoading = false

    func load() async {
        isLoading = true
        do {
            forms = try await APIClient.shared.getCACFPForms(childId: "")
        } catch {
            #if DEBUG
            forms = MockData.infantFormulaForms
            #endif
        }
        isLoading = false
    }
}

// MARK: - Medical Statement CACFP

struct MedicalStatementListView: View {
    @StateObject private var viewModel = MedicalStatementViewModel()
    @State private var showNewForm = false

    var body: some View {
        List {
            if viewModel.forms.isEmpty && !viewModel.isLoading {
                VStack(spacing: 16) {
                    Image(systemName: "cross.case.fill")
                        .font(.largeTitle)
                        .foregroundColor(.secondary)
                    Text("No Medical Statements")
                        .font(.headline)
                    Text("Medical diet modifications require a signed statement from the child's physician.")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                    Button("New Statement") { showNewForm = true }
                        .buttonStyle(.borderedProminent)
                }
                .frame(maxWidth: .infinity)
                .padding()
                .listRowBackground(Color.clear)
            } else {
                ForEach(viewModel.forms) { form in
                    NavigationLink(destination: MedicalStatementDetailView(form: form)) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(form.childName)
                                .font(.subheadline.weight(.medium))
                            Text(form.diagnosis)
                                .font(.caption)
                                .foregroundColor(.secondary)
                                .lineLimit(1)
                            Text("Dr. \(form.physicianName) · \(form.signedDate.formatted(date: .abbreviated, time: .omitted))")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                        .padding(.vertical, 2)
                    }
                }
            }
        }
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button(action: { showNewForm = true }) { Image(systemName: "plus") }
            }
        }
        .sheet(isPresented: $showNewForm) {
            MedicalStatementFormSheet { _ in
                Task { await viewModel.load() }
            }
        }
        .task { await viewModel.load() }
        .refreshable { await viewModel.load() }
        .overlay { if viewModel.isLoading { ProgressView() } }
    }
}

struct MedicalStatementDetailView: View {
    let form: MedicalStatementCACFP

    var body: some View {
        List {
            Section("Child Information") {
                LabeledContent("Child", value: form.childName)
                LabeledContent("Classroom", value: form.classroom)
            }
            Section("Physician") {
                LabeledContent("Name", value: "Dr. \(form.physicianName)")
                LabeledContent("Phone", value: form.physicianPhone)
                LabeledContent("Signed") { Text(form.signedDate, style: .date) }
            }
            Section("Medical Information") {
                LabeledContent("Diagnosis", value: form.diagnosis)
                LabeledContent("Substitutions", value: form.substitutions)
            }
            if !form.foodsToAvoid.isEmpty {
                Section("Foods to Avoid") {
                    ForEach(form.foodsToAvoid, id: \.self) { food in
                        Label(food, systemImage: "xmark.circle.fill")
                            .foregroundColor(.red)
                    }
                }
            }
            if !form.notes.isEmpty {
                Section("Notes") { Text(form.notes) }
            }
        }
        .navigationTitle("Medical Statement")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct MedicalStatementFormSheet: View {
    let onSave: (MedicalStatementCACFP) -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var childName = ""
    @State private var classroom = ""
    @State private var physicianName = ""
    @State private var physicianPhone = ""
    @State private var diagnosis = ""
    @State private var foodsToAvoid: [String] = [""]
    @State private var substitutions = ""
    @State private var signedDate = Date()
    @State private var notes = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Child Information") {
                    TextField("Child Name", text: $childName)
                    TextField("Classroom", text: $classroom)
                }
                Section("Physician") {
                    TextField("Physician Name", text: $physicianName)
                    TextField("Phone", text: $physicianPhone)
                        .keyboardType(.phonePad)
                    DatePicker("Date Signed", selection: $signedDate, displayedComponents: .date)
                }
                Section("Medical Information") {
                    TextField("Diagnosis / Medical Condition", text: $diagnosis)
                    TextField("Required Substitutions", text: $substitutions, axis: .vertical)
                        .lineLimit(2...4)
                }
                Section("Foods to Avoid") {
                    ForEach(foodsToAvoid.indices, id: \.self) { i in
                        HStack {
                            TextField("Food item \(i + 1)", text: $foodsToAvoid[i])
                            if foodsToAvoid.count > 1 {
                                Button(action: { foodsToAvoid.remove(at: i) }) {
                                    Image(systemName: "minus.circle.fill").foregroundColor(.red)
                                }
                            }
                        }
                    }
                    Button(action: { foodsToAvoid.append("") }) {
                        Label("Add Food", systemImage: "plus.circle")
                    }
                }
                Section("Notes") {
                    TextEditor(text: $notes).frame(minHeight: 60)
                }
            }
            .navigationTitle("Medical Statement")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(childName.isEmpty || physicianName.isEmpty || diagnosis.isEmpty)
                }
            }
        }
    }

    private func save() {
        let form = MedicalStatementCACFP(
            id: UUID().uuidString, childId: UUID().uuidString,
            childName: childName, classroom: classroom,
            physicianName: physicianName, physicianPhone: physicianPhone,
            diagnosis: diagnosis,
            foodsToAvoid: foodsToAvoid.filter { !$0.isEmpty },
            substitutions: substitutions,
            signedDate: signedDate, notes: notes
        )
        onSave(form)
        dismiss()
    }
}

@MainActor
class MedicalStatementViewModel: ObservableObject {
    @Published var forms: [MedicalStatementCACFP] = []
    @Published var isLoading = false

    func load() async {
        isLoading = true
        do {
            forms = try await APIClient.shared.getMedicalStatements(childId: "")
        } catch {
            #if DEBUG
            forms = MockData.medicalStatements
            #endif
        }
        isLoading = false
    }
}
