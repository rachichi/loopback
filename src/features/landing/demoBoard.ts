// The fake board behind the landing page demo. Nothing here comes from the database: it is the same shape as a
// real Board, handed to StaticBoardProvider, so the app's own components render it with no sign-in.
import type { Board } from "../../lib/board";
import boardLogo from "./assets/board-logo.png";

const boundary = {"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[-73.92872,40.6645],[-73.9316,40.66323],[-73.9309,40.65661],[-73.9597,40.65484],[-73.95986,40.65563],[-73.96188,40.65488],[-73.96308,40.6622],[-73.96225,40.6632],[-73.96096,40.66329],[-73.96257,40.67162],[-73.95527,40.67012],[-73.92835,40.66865],[-73.92872,40.6645]]]},"properties":{"BoroCD":309}}]} as GeoJSON.GeoJsonObject;

export const demoBoard: Board = {
  id: "demo",
  name: "Brooklyn Community Board 9",
  borough: "Brooklyn",
  logoUrl: boardLogo,
  backgroundUrl: null,
  boundary,
  ticketTypes: [
    { label: "Quality of Life Complaint", css_class: "quality", definition: "Ongoing neighborhood conditions that affect daily life." },
    { label: "Public Safety Issue", css_class: "safety", definition: "Crime, policing, or hazards to personal safety." },
    { label: "Liquor License", css_class: "liquor", definition: "Anything involving the State Liquor Authority." },
    { label: "Land Use Request", css_class: "land-use", definition: "Development proposals, zoning and requests to use or build on a site." },
    { label: "Transportation Request", css_class: "transport", definition: "Transit service, street design and traffic safety." },
    { label: "Other", css_class: "other", definition: "An action item that fits no other type." },
  ],
  features: { district_map: true, transcript_matching: true },
  role: null,
  shareToken: null,
};
