let students = [];
let schools = [];
let attendanceRecords = [];

document.addEventListener("DOMContentLoaded", async () => {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error || !data.session) {
    window.location.replace("./login.html");
    return;
  }

  setupWeeks();
  await loadSchools();
  await loadStudents();
  await loadAttendance();
});

async function logout() {
  await supabaseClient.auth.signOut();
  window.location.replace("./login.html");
}

async function loadSchools() {
  const schoolSelect = document.getElementById("school");

  const { data, error } = await supabaseClient
    .from("schools")
    .select("id, school_name")
    .order("school_name");

  if (error) {
    alert("School load error: " + error.message);
    return;
  }

  schools = data || [];
  schoolSelect.innerHTML = `<option value="">Select School</option>`;

  schools.forEach(school => {
    const option = document.createElement("option");
    option.value = school.id;
    option.textContent = school.school_name;
    schoolSelect.appendChild(option);
  });
}

async function addStudent() {
  const sasid = document.getElementById("sasid").value.trim();
  const firstName = document.getElementById("firstName").value.trim();
  const lastName = document.getElementById("lastName").value.trim();
  const schoolId = document.getElementById("school").value;

  if (!sasid || !firstName || !lastName || !schoolId) {
    alert("Enter SASID, First Name, Last Name, and School.");
    return;
  }

  const fullName = `${firstName} ${lastName}`;

  const { error } = await supabaseClient
    .from("students")
    .insert({
      sasid,
      first_name: firstName,
      last_name: lastName,
      student_name: fullName,
      school_id: Number(schoolId),
      active: true
    });

  if (error) {
    alert("Student insert error: " + error.message);
    return;
  }

  document.getElementById("sasid").value = "";
  document.getElementById("firstName").value = "";
  document.getElementById("lastName").value = "";
  document.getElementById("school").value = "";

  await loadStudents();
  await loadAttendance();
}

async function loadStudents() {
  const { data, error } = await supabaseClient
    .from("students")
    .select(`
      id,
      sasid,
      first_name,
      last_name,
      student_name,
      school_id,
      active,
      schools (
        school_name
      )
    `)
    .eq("active", true)
    .order("last_name");

  if (error) {
    alert("Student load error: " + error.message);
    return;
  }

  students = data || [];
}

async function loadAttendance() {
  const weekStart = document.getElementById("weekSelect").value;
  const weekDate = parseDate(weekStart);

  const weekEnd = new Date(weekDate);
  weekEnd.setDate(weekDate.getDate() + 4);

  const { data, error } = await supabaseClient
    .from("attendance")
    .select("*")
    .gte("attendance_date", toISODate(weekDate))
    .lte("attendance_date", toISODate(weekEnd));

  if (error) {
    alert("Attendance load error: " + error.message);
    return;
  }

  attendanceRecords = data || [];
  buildTable();
}

function buildTable() {
  const tbody = document.getElementById("attendanceBody");
  const weekStart = document.getElementById("weekSelect").value;

  tbody.innerHTML = "";

  if (students.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="empty">No students loaded.</td>
      </tr>
    `;
    return;
  }

  const startDate = parseDate(weekStart);
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

  students.forEach(student => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${student.sasid}</td>
      <td>${student.first_name || ""} ${student.last_name || ""}</td>
      <td>${student.schools ? student.schools.school_name : ""}</td>
    `;

    let total = 0;

    days.forEach((day, index) => {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + index);

      const dateISO = toISODate(currentDate);

      const record = attendanceRecords.find(r =>
        r.student_id === student.id &&
        r.attendance_date === dateISO
      );

      const checked = record && record.code === "P";

      if (checked) total++;

      const td = document.createElement("td");

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = checked;

      checkbox.addEventListener("change", async () => {
        await saveAttendance(student.id, dateISO, checkbox.checked ? "P" : "A");
      });

      const dateDiv = document.createElement("div");
      dateDiv.className = "date-text";
      dateDiv.textContent = shortDate(currentDate);

      td.appendChild(checkbox);
      td.appendChild(dateDiv);
      tr.appendChild(td);
    });

    const totalTd = document.createElement("td");
    totalTd.textContent = total;
    tr.appendChild(totalTd);

    tbody.appendChild(tr);
  });
}

async function saveAttendance(studentId, attendanceDate, code) {
  const existing = attendanceRecords.find(r =>
    r.student_id === studentId &&
    r.attendance_date === attendanceDate
  );

  if (existing) {
    const { error } = await supabaseClient
      .from("attendance")
      .update({
        code,
        updated_at: new Date().toISOString()
      })
      .eq("id", existing.id);

    if (error) {
      alert("Attendance update error: " + error.message);
      return;
    }
  } else {
    const { error } = await supabaseClient
      .from("attendance")
      .insert({
        student_id: studentId,
        attendance_date: attendanceDate,
        code
      });

    if (error) {
      alert("Attendance insert error: " + error.message);
      return;
    }
  }

  await loadAttendance();
}

function exportWeekCSV() {
  const weekStart = document.getElementById("weekSelect").value;
  const startDate = parseDate(weekStart);
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

  let headers = ["SASID", "Student Name", "School"];

  days.forEach((day, index) => {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + index);
    headers.push(`${day} ${formatDate(currentDate)}`);
  });

  headers.push("Total Present");

  let csv = headers.map(x => `"${x}"`).join(",") + "\n";

  students.forEach(student => {
    let total = 0;

    let row = [
      student.sasid,
      `${student.first_name || ""} ${student.last_name || ""}`,
      student.schools ? student.schools.school_name : ""
    ];

    days.forEach((day, index) => {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + index);

      const dateISO = toISODate(currentDate);

      const record = attendanceRecords.find(r =>
        r.student_id === student.id &&
        r.attendance_date === dateISO
      );

      if (record && record.code === "P") {
        total++;
        row.push("");
      } else {
        row.push("Absent");
      }
    });

    row.push(total);
    csv += row.map(x => `"${x}"`).join(",") + "\n";
  });

  downloadFile(csv, `ETS_Attendance_${weekStart}.csv`, "text/csv");
}

function setupWeeks() {
  const weekSelect = document.getElementById("weekSelect");
  weekSelect.innerHTML = "";

  const schoolYearEnd = new Date(2027, 5, 30); // June 30, 2027

  let monday = new Date(2026, 5, 29); // June 29, 2026
  let weekNumber = 1;

  while (monday <= schoolYearEnd) {
    let friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);

    if (friday > schoolYearEnd) {
      friday = new Date(schoolYearEnd);
    }

    const option = document.createElement("option");
    option.value = formatDate(monday);
    option.textContent =
      `Week ${weekNumber}: ${shortDate(monday)} - ${shortDate(friday)}`;

    weekSelect.appendChild(option);

    monday.setDate(monday.getDate() + 7);
    weekNumber++;
  }
}



function formatDate(date) {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yyyy = date.getFullYear();

  return `${mm}-${dd}-${yyyy}`;
}

function parseDate(text) {
  const parts = text.split("-");
  return new Date(parts[2], parts[0] - 1, parts[1]);
}

function toISODate(date) {
  return date.toISOString().split("T")[0];
}

function shortDate(date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function downloadFile(content, fileName, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const link = document.createElement("a");

  link.href = URL.createObjectURL(blob);
  link.download = fileName;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(link.href);
}
