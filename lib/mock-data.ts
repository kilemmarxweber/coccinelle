export interface Child {
  id: string
  firstName: string
  lastName: string
  birthDate: string
  age: number
  classId: string
  parentName: string
  parentPhone: string
  parentEmail: string
  address: string
  allergies: string
  notes: string
  photoUrl?: string
  registrationDate: string
}

export interface Class {
  id: string
  name: string
  description: string
  ageRange: string
  minAge: number
  maxAge: number
  teacher: string
  assistants: string[]
  room: string
  capacity: number
  childrenCount: number
}

export interface Course {
  id: string
  title: string
  description: string
  date: string
  classIds: string[]
  theme: string
  bibleVerse: string
  materials: string[]
  objectives: string[]
}

export interface AttendanceRecord {
  id: string
  childId: string
  date: string
  status: "present" | "absent" | "late" | "excused"
  notes?: string
}

export const classes: Class[] = [
  {
    id: "petits",
    name: "Les Petits Anges",
    description: "Classe pour les tout-petits, avec des activites ludiques et des histoires bibliques simples.",
    ageRange: "3-5 ans",
    minAge: 3,
    maxAge: 5,
    teacher: "Marie Leclerc",
    assistants: ["Sophie Bernard", "Claire Moreau"],
    room: "Salle A1",
    capacity: 15,
    childrenCount: 12,
  },
  {
    id: "moyens",
    name: "Les Explorateurs",
    description: "Classe interactive avec etudes bibliques adaptees et activites manuelles.",
    ageRange: "6-8 ans",
    minAge: 6,
    maxAge: 8,
    teacher: "Jean-Pierre Dubois",
    assistants: ["Marc Antoine"],
    room: "Salle B2",
    capacity: 20,
    childrenCount: 18,
  },
  {
    id: "grands",
    name: "Les Disciples",
    description: "Etudes approfondies de la Bible avec discussions et projets de groupe.",
    ageRange: "9-12 ans",
    minAge: 9,
    maxAge: 12,
    teacher: "Anne-Marie Fontaine",
    assistants: ["Paul Martin", "Julie Rousseau"],
    room: "Salle C3",
    capacity: 25,
    childrenCount: 15,
  },
  {
    id: "ados",
    name: "Les Temoins",
    description: "Groupe de jeunes adolescents pour des discussions profondes sur la foi.",
    ageRange: "13-15 ans",
    minAge: 13,
    maxAge: 15,
    teacher: "David Petit",
    assistants: ["Sarah Blanc"],
    room: "Salle D4",
    capacity: 20,
    childrenCount: 10,
  },
]

export const children: Child[] = [
  {
    id: "1",
    firstName: "Lucas",
    lastName: "Martin",
    birthDate: "2019-03-15",
    age: 7,
    classId: "moyens",
    parentName: "Pierre et Marie Martin",
    parentPhone: "+33 6 12 34 56 78",
    parentEmail: "martin.famille@email.com",
    address: "12 Rue de la Paix, 75001 Paris",
    allergies: "Arachides",
    notes: "Tres attentif, aime chanter les louanges.",
    registrationDate: "2023-09-01",
  },
  {
    id: "2",
    firstName: "Emma",
    lastName: "Dupont",
    birthDate: "2018-07-22",
    age: 7,
    classId: "moyens",
    parentName: "Jacques Dupont",
    parentPhone: "+33 6 98 76 54 32",
    parentEmail: "j.dupont@email.com",
    address: "45 Avenue des Champs, 75008 Paris",
    allergies: "",
    notes: "Timide au debut mais s'integre bien.",
    registrationDate: "2024-01-15",
  },
  {
    id: "3",
    firstName: "Noah",
    lastName: "Bernard",
    birthDate: "2020-11-08",
    age: 5,
    classId: "petits",
    parentName: "Sophie Bernard",
    parentPhone: "+33 6 11 22 33 44",
    parentEmail: "s.bernard@email.com",
    address: "78 Boulevard Haussmann, 75009 Paris",
    allergies: "Gluten",
    notes: "Tres energique, a besoin d'activites physiques.",
    registrationDate: "2024-02-20",
  },
  {
    id: "4",
    firstName: "Chloe",
    lastName: "Moreau",
    birthDate: "2015-04-30",
    age: 11,
    classId: "grands",
    parentName: "Claire Moreau",
    parentPhone: "+33 6 55 66 77 88",
    parentEmail: "claire.moreau@email.com",
    address: "23 Rue Victor Hugo, 75016 Paris",
    allergies: "",
    notes: "Excellente lectrice, aide les plus jeunes.",
    registrationDate: "2021-09-05",
  },
  {
    id: "5",
    firstName: "Gabriel",
    lastName: "Leroy",
    birthDate: "2017-09-12",
    age: 8,
    classId: "moyens",
    parentName: "Thomas et Julie Leroy",
    parentPhone: "+33 6 99 88 77 66",
    parentEmail: "leroy.famille@email.com",
    address: "56 Rue de Rivoli, 75004 Paris",
    allergies: "Lactose",
    notes: "",
    registrationDate: "2022-09-01",
  },
  {
    id: "6",
    firstName: "Lea",
    lastName: "Simon",
    birthDate: "2021-02-14",
    age: 5,
    classId: "petits",
    parentName: "Marie Simon",
    parentPhone: "+33 6 44 55 66 77",
    parentEmail: "m.simon@email.com",
    address: "89 Avenue Foch, 75116 Paris",
    allergies: "",
    notes: "Premiere annee a l'ecodim.",
    registrationDate: "2024-09-01",
  },
  {
    id: "7",
    firstName: "Raphael",
    lastName: "Petit",
    birthDate: "2014-12-25",
    age: 11,
    classId: "grands",
    parentName: "David Petit",
    parentPhone: "+33 6 22 33 44 55",
    parentEmail: "d.petit@email.com",
    address: "34 Rue Saint-Honore, 75001 Paris",
    allergies: "",
    notes: "Fils du moniteur, tres implique.",
    registrationDate: "2020-09-01",
  },
  {
    id: "8",
    firstName: "Ines",
    lastName: "Blanc",
    birthDate: "2019-06-18",
    age: 6,
    classId: "moyens",
    parentName: "Sarah Blanc",
    parentPhone: "+33 6 77 88 99 00",
    parentEmail: "s.blanc@email.com",
    address: "67 Rue de la Republique, 75003 Paris",
    allergies: "Oeufs",
    notes: "Vient de rejoindre la classe des Moyens.",
    registrationDate: "2024-04-15",
  },
]

export const courses: Course[] = [
  {
    id: "1",
    title: "L'histoire de David et Goliath",
    description: "Decouvrir comment David a vaincu Goliath avec sa foi en Dieu.",
    date: "2024-05-05",
    classIds: ["moyens", "grands"],
    theme: "La foi et le courage",
    bibleVerse: "1 Samuel 17:45",
    materials: ["Images de David et Goliath", "Pierres decoratives", "Coloriages"],
    objectives: [
      "Comprendre l'importance de la foi",
      "Apprendre que Dieu nous donne du courage",
      "Memoriser le verset cle",
    ],
  },
  {
    id: "2",
    title: "Jonas et la baleine",
    description: "L'histoire de Jonas qui a fui Dieu puis s'est repenti.",
    date: "2024-05-12",
    classIds: ["petits", "moyens"],
    theme: "L'obeissance a Dieu",
    bibleVerse: "Jonas 2:9",
    materials: ["Marionnette de baleine", "Livre illustre", "Activite de bricolage"],
    objectives: [
      "Apprendre l'importance d'obeir a Dieu",
      "Comprendre que Dieu pardonne",
      "Creer une baleine en papier",
    ],
  },
  {
    id: "3",
    title: "Les Beatitudes",
    description: "Etude des enseignements de Jesus sur la montagne.",
    date: "2024-05-19",
    classIds: ["grands"],
    theme: "Les valeurs du Royaume",
    bibleVerse: "Matthieu 5:3-12",
    materials: ["Cahiers d'etude", "Videos", "Fiches de discussion"],
    objectives: [
      "Comprendre chaque beatitude",
      "Appliquer ces valeurs dans la vie quotidienne",
      "Discussion en groupe",
    ],
  },
  {
    id: "4",
    title: "La creation du monde",
    description: "Decouvrir les 7 jours de la creation.",
    date: "2024-05-26",
    classIds: ["petits"],
    theme: "Dieu Createur",
    bibleVerse: "Genese 1:1",
    materials: ["Images de la nature", "Pate a modeler", "Coloriages"],
    objectives: [
      "Apprendre les jours de la creation",
      "Remercier Dieu pour sa creation",
      "Activite artistique",
    ],
  },
]

export const attendanceRecords: AttendanceRecord[] = [
  { id: "1", childId: "1", date: "2024-05-05", status: "present" },
  { id: "2", childId: "2", date: "2024-05-05", status: "present" },
  { id: "3", childId: "3", date: "2024-05-05", status: "absent", notes: "Malade" },
  { id: "4", childId: "4", date: "2024-05-05", status: "present" },
  { id: "5", childId: "5", date: "2024-05-05", status: "late", notes: "Arrive a 10h15" },
  { id: "6", childId: "6", date: "2024-05-05", status: "present" },
  { id: "7", childId: "7", date: "2024-05-05", status: "present" },
  { id: "8", childId: "8", date: "2024-05-05", status: "excused", notes: "Voyage familial" },
  { id: "9", childId: "1", date: "2024-04-28", status: "present" },
  { id: "10", childId: "2", date: "2024-04-28", status: "present" },
  { id: "11", childId: "3", date: "2024-04-28", status: "present" },
  { id: "12", childId: "4", date: "2024-04-28", status: "present" },
  { id: "13", childId: "5", date: "2024-04-28", status: "absent" },
  { id: "14", childId: "6", date: "2024-04-28", status: "present" },
  { id: "15", childId: "7", date: "2024-04-28", status: "present" },
  { id: "16", childId: "8", date: "2024-04-28", status: "present" },
]

export function getChildrenByClass(classId: string): Child[] {
  return children.filter((child) => child.classId === classId)
}

export function getChildById(id: string): Child | undefined {
  return children.find((child) => child.id === id)
}

export function getClassById(id: string): Class | undefined {
  return classes.find((c) => c.id === id)
}

export function getAttendanceByChild(childId: string): AttendanceRecord[] {
  return attendanceRecords.filter((record) => record.childId === childId)
}

export function getAttendanceByDate(date: string): AttendanceRecord[] {
  return attendanceRecords.filter((record) => record.date === date)
}

export function getCoursesByClass(classId: string): Course[] {
  return courses.filter((course) => course.classIds.includes(classId))
}
