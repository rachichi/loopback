// The public About page (/landing/about): static copy, and a testimonials carousel. No database calls.
// Loaded with React.lazy from App.tsx, like the landing page.
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import loopbackLogo from "../../assets/logo.png";
import { trackEvent, trackPage } from "../../lib/analytics";
import IntakeModal from "./IntakeModal";
import { testimonials } from "./testimonials";
import "./landing.css";

const APP_URL = (import.meta.env.VITE_APP_URL as string | undefined) ?? window.location.origin;

/** One quote at a time. With a single testimonial it is just a card; with more, arrows and dots appear. */
function Testimonials() {
  const [index, setIndex] = useState(0);
  const count = testimonials.length;
  const go = (next: number) => setIndex((next + count) % count);
  return (
    <div className="lp-carousel" role="region" aria-roledescription="carousel" aria-label="What community board staff say">
      <div className="lp-carousel-track" style={{ transform: `translateX(-${index * 100}%)` }}>
        {testimonials.map((item, i) => (
          <figure key={i} className="lp-quote" aria-hidden={i !== index} aria-roledescription="slide" aria-label={`${i + 1} of ${count}`}>
            {item.photo && <img src={item.photo} alt={item.name} />}
            <blockquote>“{item.quote}”</blockquote>
            <figcaption><strong>{item.name}</strong><span>{item.role}</span></figcaption>
          </figure>
        ))}
      </div>
      {count > 1 && (
        <div className="lp-carousel-controls">
          <button type="button" aria-label="Previous quote" onClick={() => go(index - 1)}><ChevronLeft size={20} /></button>
          <div className="lp-dots">
            {testimonials.map((_, i) => <button key={i} type="button" aria-label={`Quote ${i + 1}`} aria-current={i === index} className={i === index ? "on" : ""} onClick={() => go(i)} />)}
          </div>
          <button type="button" aria-label="Next quote" onClick={() => go(index + 1)}><ChevronRight size={20} /></button>
        </div>
      )}
    </div>
  );
}

export default function About() {
  const [contactOpen, setContactOpen] = useState(false);
  useEffect(() => { trackPage("/landing/about", "About"); }, []);

  return (
    <div className="lp">
      <header className="lp-header">
        <a className="lp-brand" href="/landing" aria-label="Loopback">
          <img src={loopbackLogo} alt="" />
          <span>Loopback</span>
        </a>
        <nav className="lp-nav">
          <a href="/landing/about" aria-current="page">About</a>
          <a className="lp-signin" href={APP_URL} onClick={() => trackEvent("landing_signin_clicked")}>Sign in</a>
        </nav>
      </header>

      <section className="lp-hero lp-about-hero">
        <div className="lp-hero-inner">
          <h1>How Loopback works</h1>
        </div>
      </section>

      <main className="lp-about">
        <section>
          <h2>Our vision</h2>
          <p>Democracy starts with local government, and local government starts with community boards. However, community boards today are run by just a handful of (incredible) staff and volunteers who are tasked with the tall order of representing and supporting every constituent. As such, administrative tasks and resident requests pile up, leaving little time to truly improve their neighborhood.</p>
          <p>By building tailored tools and automations in direct conversation with community boards, we enable local government to reach its highest potential.</p>
        </section>

        <section>
          <h2>How we work</h2>
          <p>Our team works directly with industry leaders in tech and AI, and NYC government bodies such as the borough presidents’ offices, community boards, and the Office of Technology and Innovation to refine and develop new features.</p>
        </section>

        <section>
          <h2>AI usage</h2>
          <p>Based on feedback and requests from our users, we've implemented AI solutions to streamline ticket generation and meeting minutes. All AI features are clearly marked in Loopback (on the Meeting tab), and no AI-generated outputs are seen and shared externally until verified by community board staff.</p>
        </section>

        <section>
          <h2>What boards are saying</h2>
          <Testimonials />
        </section>
      </main>

      <section className="lp-closing lp-about-closing">
        <h2>Try Loopback now.</h2>
        <button type="button" className="lp-cta" onClick={() => { trackEvent("landing_cta_clicked", { source: "about" }); setContactOpen(true); }}>Get Loopback for your board <ChevronRight size={18} aria-hidden="true" /></button>
      </section>

      <footer className="portal-footer">
        <div className="portal-footer-inner">
          <img src={loopbackLogo} alt="Loopback" />
          <div className="portal-footer-contact">
            <p>Loopback for community boards.</p>
            <p>The Loopback portal was launched in 2026 by community members<br />to empower the community boards that serve them.</p>
            <p><button type="button" className="lp-footer-link" onClick={() => { trackEvent("landing_cta_clicked", { source: "footer" }); setContactOpen(true); }}>Contact us</button> for questions, feedback, or feature requests.</p>
          </div>
        </div>
      </footer>

      {contactOpen && <IntakeModal onClose={() => setContactOpen(false)} />}
    </div>
  );
}
