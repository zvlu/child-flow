import XCTest
@testable import ChildFlow

final class ChildFlowTests: XCTestCase {
    func testChildInitials() {
        let child = Child(
            id: "1", firstName: "Maria", lastName: "Garcia",
            dateOfBirth: "2019-05-01", gender: "Female",
            primaryLanguage: "Spanish", classroom: "Sunshine",
            teacher: "Ms. Johnson", enrollmentStatus: "Active",
            healthStatus: "Current", attendanceRate: 92,
            parentName: "Ana Garcia", parentPhone: "555-0100",
            allergies: []
        )
        XCTAssertEqual(child.initials, "MG")
        XCTAssertEqual(child.fullName, "Maria Garcia")
    }

    func testAttendanceStatusColor() {
        XCTAssertEqual(AttendanceStatus.present.displayName, "Present")
        XCTAssertEqual(AttendanceStatus.absent.displayName, "Absent")
    }
}
