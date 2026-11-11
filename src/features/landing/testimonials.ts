import dante from "./assets/dante.jpg";

export type Testimonial = { quote: string; name: string; role: string; photo?: string };

/** Add an entry here and the About page turns the single quote into a carousel. Newest last. */
export const testimonials: Testimonial[] = [
  {
    quote: "I personally love this… it will save [our committees] loads of time… this is dope.",
    name: "Dante",
    role: "District Manager, Brooklyn Community Board 9",
    photo: dante,
  },
];
