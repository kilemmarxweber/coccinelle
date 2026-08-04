export { dayBounds, startOfToday, todayIsoLocal } from "./day-bounds";
export {
  OrganizationScopeError,
  getDepartForOrganization,
  listDepartsDuJour,
  resolveOrganizationScope,
  searchDeparts,
} from "./search-departs";
export type {
  ListDepartsDuJourInput,
  PublicDepartDetail,
  SearchDepartResult,
  SearchDepartsInput,
  SearchDepartsResult,
} from "./types";

// Server Action : importer depuis `@/lib/search-departs/actions` (pas ce barrel)
// pour éviter de mélanger domaine Prisma et client components.
