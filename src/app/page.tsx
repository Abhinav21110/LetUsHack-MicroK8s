"use client";

import React, { useEffect, useRef } from "react";
import LetterGlitch from "@/components/LetterGlitch";
import ElectricBorder from "@/components/ElectricBorder";
import TextAnimation from "@/components/ui/scroll-text";
import GlassIcons from "@/components/GlassIcons";
import { ReactLenis } from "lenis/react";

export default function Page() {
  const section1Ref = useRef<HTMLElement>(null);
  const section2Ref = useRef<HTMLElement>(null);
  const section3Ref = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const differencesSectionRef = useRef<HTMLDivElement>(null);
  const allSectionsRef = useRef<HTMLElement[]>([]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;

      // Fade out section 1
      if (section1Ref.current) {
        const opacity = Math.max(0, 1 - scrollY / windowHeight);
        section1Ref.current.style.opacity = opacity.toString();
      }

      // Fade out section 2
      if (section2Ref.current) {
        const opacity = Math.max(
          0,
          1 - (scrollY - windowHeight) / windowHeight
        );
        section2Ref.current.style.opacity = opacity.toString();
      }

      // Fade out section 3
      if (section3Ref.current) {
        const opacity = Math.max(
          0,
          1 - (scrollY - windowHeight * 2) / windowHeight
        );
        section3Ref.current.style.opacity = opacity.toString();
      }

      // Show "What Makes Us Different" heading after 2nd section (after 2 screen heights)
      if (headingRef.current) {
        const showAfter = windowHeight * 2;
        if (scrollY >= showAfter) {
          headingRef.current.style.opacity = "1";
        } else {
          headingRef.current.style.opacity = "0";
        }
      } // Fade out the entire "What Makes Us Different" section
      if (differencesSectionRef.current) {
        const sectionTop = differencesSectionRef.current.offsetTop;
        const sectionHeight = differencesSectionRef.current.offsetHeight;
        const sectionBottom = sectionTop + sectionHeight;
        const scrollBottom = scrollY + windowHeight;

        // Start fading when we reach the bottom of the section
        if (scrollBottom > sectionBottom) {
          const fadeDistance = windowHeight * 0.5; // Fade over half a screen
          const fadeProgress = Math.min(
            1,
            (scrollBottom - sectionBottom) / fadeDistance
          );
          const opacity = Math.max(0, 1 - fadeProgress);
          differencesSectionRef.current.style.opacity = opacity.toString();
        } else {
          differencesSectionRef.current.style.opacity = "1";
        }
      }

      // Fade effect for all remaining sections
      allSectionsRef.current.forEach((section) => {
        if (!section) return;

        const rect = section.getBoundingClientRect();
        const sectionTop = rect.top;
        const sectionHeight = rect.height;
        const sectionBottom = rect.bottom;

        // Section is fully in viewport - keep it fully visible
        if (sectionTop >= -100 && sectionBottom <= windowHeight + 100) {
          section.style.opacity = "1";
        }
        // Section is entering from bottom
        else if (sectionTop > 0 && sectionTop < windowHeight) {
          const fadeInProgress = Math.min(
            1,
            (windowHeight - sectionTop) / (windowHeight * 0.3)
          );
          section.style.opacity = Math.max(0.3, fadeInProgress).toString();
        }
        // Section is partially visible at top (scrolling up)
        else if (sectionTop < 0 && sectionBottom > 0) {
          const visibleRatio = sectionBottom / sectionHeight;
          if (visibleRatio > 0.2) {
            section.style.opacity = "1";
          } else {
            section.style.opacity = Math.max(0.3, visibleRatio * 3).toString();
          }
        }
        // Section is completely out of viewport
        else if (sectionTop >= windowHeight || sectionBottom <= 0) {
          section.style.opacity = "0";
        }
      });
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll(); // Initial check
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Intersection-based reveal for post-card sections
  useEffect(() => {
    const targets = Array.from(
      document.querySelectorAll("[data-scroll-section]")
    ) as HTMLElement[];

    // Store references for fade effect
    allSectionsRef.current = targets;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("scroll-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );

    targets.forEach((el) => {
      el.classList.add("scroll-hidden");
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);
  return (
    <ReactLenis root>
      <main className="min-h-screen min-h-[100dvh] bg-black text-white relative">
        {/* Background */}
        <div className="fixed inset-0 w-screen h-screen z-0">
          <LetterGlitch
            glitchColors={["#382020ff", "#b10505ff", "#6d1313ff"]}
          />
        </div>
        {/* Content */}
        <div className="relative pointer-events-none z-10">
          {/* Section 1: Your College... */}
          <section
            ref={section1Ref}
            className="h-screen w-full grid place-content-center sticky top-0 px-6 transition-opacity duration-300"
          >
            <div className="pointer-events-auto">
              <TextAnimation
                as="h1"
                text="Your College Isn't Telling You Everything about us...But We Will."
                classname="text-4xl md:text-5xl lg:text-6xl font-bold text-center tracking-tight leading-[120%] text-gray-300"
                direction="up"
              />
              <p className="text-center text-gray-400 mt-8 text-xl">
                Scroll down 👇
              </p>
            </div>
          </section>
          {/* Section 2: Introducing Let Us Hack */}
          <section
            ref={section2Ref}
            className="h-screen w-full grid place-content-center sticky top-0 px-6 transition-opacity duration-300"
          >
            <div className="pointer-events-auto">
              <TextAnimation
                as="h2"
                text="Introducing the first-ever home-grown cybersecurity training platform"
                classname="text-3xl md:text-4xl font-semibold text-center tracking-tight leading-[120%] text-gray-200 mb-6"
                direction="left"
              />
              <h1
                className="font-extrabold text-center text-red-500 whitespace-nowrap"
                style={{ fontSize: "clamp(3rem, 15vw, 8rem)" }}
              >
                Let Us Hack
              </h1>
              <p className="text-2xl md:text-3xl font-medium text-center tracking-tight leading-[140%] text-gray-300 max-w-4xl mx-auto mt-8 px-4">
                Built by{" "}
                <span className="text-red-500 font-bold">2nd year</span>{" "}
                students from all four campuses, for students of all four
                campuses.
              </p>
              <div className="flex justify-center mt-12">
                <a
                  href="/login"
                  className="group relative inline-flex items-center gap-2 px-8 py-4 text-lg font-bold text-white bg-gradient-to-r from-red-600 to-red-700 rounded-full hover:from-red-700 hover:to-red-800 transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(239,68,68,0.5)]"
                >
                  <span>Get Started</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="group-hover:translate-x-1 transition-transform"
                  >
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </a>
              </div>
            </div>
          </section>
          {/* Card-based Smooth Scroll Section */}
          <div
            ref={differencesSectionRef}
            className="w-full relative transition-opacity duration-300"
          >
            <section>
              {/* What Makes Us Different Title - Fixed at top */}
              <div
                ref={headingRef}
                className="fixed top-8 left-0 right-0 z-20 pointer-events-none opacity-0 transition-opacity duration-500"
              >
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center tracking-tight leading-[120%] text-white">
                  What Makes Us Different 🔥
                </h2>
              </div>

              <div className="px-8 lg:px-16 pt-32">
                <div className="grid gap-2 max-w-3xl mx-auto">
                  {/* What Makes Us Different Cards */}
                  <figure className="sticky top-0 h-screen grid place-content-center">
                    <article className="bg-gradient-to-br from-red-600 to-red-800 h-72 w-full max-w-2xl rounded-lg rotate-3 p-6 grid place-content-center gap-4 shadow-2xl">
                      <h3 className="text-2xl font-bold">
                        Immersive Learning Experience
                      </h3>
                      <p className="text-gray-100">
                        You do cybersecurity — break things, fix things,
                        understand attacks, defend against attacks
                      </p>
                    </article>
                  </figure>

                  <figure className="sticky top-0 h-screen grid place-content-center">
                    <article className="bg-gradient-to-br from-orange-600 to-red-700 h-72 w-full max-w-2xl rounded-lg -rotate-2 p-6 grid place-content-center gap-4 shadow-2xl">
                      <h3 className="text-2xl font-bold">
                        A Community of Cybersecurity Enthusiasts Across All 4
                        Colleges
                      </h3>
                      <p className="text-gray-100">
                        One united cybersecurity community where juniors,
                        seniors, mentors, and workshop teams collaborate
                      </p>
                    </article>
                  </figure>

                  <figure className="sticky top-0 h-screen grid place-content-center">
                    <article className="bg-gradient-to-br from-red-700 to-pink-700 h-72 w-full max-w-2xl rounded-lg rotate-2 p-6 grid place-content-center gap-4 shadow-2xl">
                      <h3 className="text-2xl font-bold">
                        Gamified Hands-On Learning
                      </h3>
                      <p className="text-gray-100">
                        Learn through missions, achievements — it's
                        cybersecurity, turning knowledge into action
                      </p>
                    </article>
                  </figure>

                  <figure className="sticky top-0 h-screen grid place-content-center">
                    <article className="bg-gradient-to-br from-red-800 to-rose-800 h-72 w-full max-w-2xl rounded-lg -rotate-1 p-6 grid place-content-center gap-4 shadow-2xl">
                      <h3 className="text-2xl font-bold">
                        Campus CTFs (Coming Soon!)
                      </h3>
                      <p className="text-gray-100">
                        We're bringing hands-on workshops and inter-campus CTF
                        competitions — fight for your campus!
                      </p>
                    </article>
                  </figure>

                  <figure className="sticky top-0 h-screen grid place-content-center">
                    <article className="bg-gradient-to-br from-red-600 to-red-900 h-72 w-full max-w-2xl rounded-lg rotate-1 p-6 grid place-content-center gap-4 shadow-2xl">
                      <h3 className="text-2xl font-bold">
                        One-Stop Learning Hub
                      </h3>
                      <p className="text-gray-100">
                        All your cybersecurity needs in one place — no more
                        searching 10 websites or watching 120 random courses
                      </p>
                    </article>
                  </figure>
                </div>
              </div>
            </section>
          </div>
          {/* Regular Scroll Content - flows naturally after the cards section */}
          <div className="relative" data-scroll-section>
            {/* Our Achievements */}
            <section className="py-20 w-full px-6" data-scroll-section>
              <div className="pointer-events-auto max-w-5xl mx-auto">
                <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 text-white">
                  Our Achievements So Far
                </h2>
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                  {/* KMEC Card */}
                  <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-900/30 via-red-900/20 to-red-800/30 border border-red-500/30 p-8 hover:border-red-400/50 transition-all duration-500 hover:shadow-[0_0_40px_rgba(239,68,68,0.3)] hover:scale-105 hover:-translate-y-2 cursor-pointer">
                    <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-red-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <div className="absolute -top-12 -right-12 w-40 h-40 bg-red-500/20 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700"></div>
                    <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-red-600/10 rounded-full blur-2xl"></div>

                    <div className="relative z-10">
                      <div className="flex items-start gap-4 mb-4">
                        <div className="flex-1">
                          <h3 className="text-2xl font-bold mb-1 text-red-400 group-hover:text-red-300 transition-colors">
                            KMEC Workshop
                          </h3>
                          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 group-hover:bg-red-500/30 group-hover:scale-110 transition-all duration-300">
                            SUCCESS
                          </span>
                        </div>
                      </div>

                      <p className="text-gray-300 mb-4 leading-relaxed group-hover:text-gray-200 transition-colors duration-300">
                        Hands-on cybersecurity training with 120+ learners
                        successfully trained
                      </p>
                    </div>
                  </div>

                  {/* NGIT Card */}
                  <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-900/30 via-red-900/20 to-red-800/30 border border-red-500/30 p-8 hover:border-red-400/50 transition-all duration-500 hover:shadow-[0_0_40px_rgba(239,68,68,0.3)] hover:scale-105 hover:-translate-y-2 cursor-pointer">
                    <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-red-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <div className="absolute -top-12 -right-12 w-40 h-40 bg-red-500/20 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700"></div>
                    <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-red-600/10 rounded-full blur-2xl"></div>{" "}
                    <div className="relative z-10">
                      <div className="flex items-start gap-4 mb-4">
                        <div className="flex-1">
                          <h3 className="text-2xl font-bold mb-1 text-red-400 group-hover:text-red-300 transition-colors">
                            NGIT Workshop
                          </h3>
                          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 group-hover:bg-red-500/30 group-hover:scale-110 transition-all duration-300">
                            VIRAL
                          </span>
                        </div>
                      </div>

                      <p className="text-gray-300 mb-4 leading-relaxed group-hover:text-gray-200 transition-colors duration-300">
                        Packed auditorium with crazy engagement and enthusiastic
                        participants
                      </p>
                    </div>
                  </div>
                </div>

                <div className="text-center">
                  <div className="inline-block relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-red-600 rounded-full blur-xl opacity-50 group-hover:opacity-75 transition-opacity"></div>
                    <div className="relative px-8 py-4 rounded-full bg-gradient-to-r from-red-500/20 to-red-600/20 border-2 border-red-500/40 backdrop-blur-sm group-hover:border-red-400/60 transition-all">
                      <p className="text-white-400 font-bold text-lg">
                        More campuses coming next semester 👀
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
            {/* What We're Doing on Campus */}
            <section className="py-20 w-full px-6" data-scroll-section>
              <div className="pointer-events-auto max-w-6xl mx-auto">
                <h2 className="text-3xl md:text-4xl font-bold text-center mb-10">
                  What We're Doing on Campus
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
                  <div className="p-6 md:p-8 rounded-xl bg-zinc-900/60 backdrop-blur-sm min-h-[200px] flex flex-col justify-between border-2 border-red-500">
                    <h3 className="text-xl font-bold mb-2">Workshops</h3>
                    <p className="text-gray-300">
                      Interactive, practical, beginner‑friendly sessions to
                      learn by doing.
                    </p>
                  </div>
                  <div className="p-6 md:p-8 rounded-xl bg-zinc-900/60 backdrop-blur-sm min-h-[200px] flex flex-col justify-between border-2 border-red-500">
                    <h3 className="text-xl font-bold mb-2">Case Studies</h3>
                    <p className="text-gray-300">
                      Deep‑dives into real incidents: investigations, data
                      leaks, scams,and more.
                    </p>
                  </div>
                  <div className="p-6 md:p-8 rounded-xl bg-zinc-900/60 backdrop-blur-sm min-h-[200px] flex flex-col justify-between border-2 border-red-500">
                    <h3 className="text-xl font-bold mb-2">Cyber Pranks</h3>
                    <p className="text-gray-300">
                      Campus-safe awareness stunts showing how easy hacking can
                      look.
                    </p>
                  </div>
                </div>
              </div>
            </section>
            {/* This Is Only the Beginning */}
            <section
              className="py-32 w-full px-6 relative overflow-hidden"
              data-scroll-section
            >
              <div className="absolute inset-0 bg-gradient-radial from-red-900/20 via-transparent to-transparent opacity-50"></div>
              <div className="pointer-events-auto max-w-4xl mx-auto relative">
                <div className="text-center mb-16">
                  <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-center mb-6 text-white">
                    This Is Only the Beginning.
                  </h2>
                  <div className="h-1 w-32 mx-auto bg-gradient-to-r from-transparent via-red-500 to-transparent rounded-full"></div>
                </div>{" "}
                <div className="relative">
                  <div className="absolute -inset-4 bg-gradient-to-r from-red-600/20 to-red-800/20 blur-2xl rounded-full"></div>
                  <div className="relative backdrop-blur-sm bg-gradient-to-br from-red-950/40 via-black/60 to-red-950/40 border border-red-500/30 rounded-2xl p-8 md:p-12 shadow-[0_0_50px_rgba(239,68,68,0.2)]">
                    <h3 className="text-2xl md:text-3xl font-bold text-red-400 mb-8 text-center">
                      A stable release is rolling out soon.
                    </h3>
                    <div className="space-y-6">
                      <div className="flex items-start gap-4 group hover:translate-x-2 transition-transform duration-300">
                        <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-red-500 group-hover:scale-150 transition-transform"></div>
                        <p className="text-lg md:text-xl text-gray-300 group-hover:text-white transition-colors">
                          New missions accompanied by new tracks!
                        </p>
                      </div>
                      <div className="flex items-start gap-4 group hover:translate-x-2 transition-transform duration-300">
                        <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-red-500 group-hover:scale-150 transition-transform"></div>
                        <p className="text-lg md:text-xl text-gray-300 group-hover:text-white transition-colors">
                          New campus events!!
                        </p>
                      </div>
                      <div className="flex items-start gap-4 group hover:translate-x-2 transition-transform duration-300">
                        <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-red-500 group-hover:scale-150 transition-transform"></div>
                        <p className="text-lg md:text-xl text-gray-300 group-hover:text-white transition-colors">
                          All on a new learning platform.
                        </p>
                      </div>
                    </div>

                    <div className="mt-12 pt-8 border-t border-red-500/20">
                      <p className="text-xl md:text-2xl font-semibold text-center text-transparent bg-gradient-to-r from-red-400 via-red-300 to-red-400 bg-clip-text">
                        Cybersecurity is no longer optional — and now, it's
                        finally accessible.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
            {/* Stay Connected */}
            <section className="py-20 w-full px-6" data-scroll-section>
              <div className="pointer-events-auto max-w-3xl mx-auto">
                <h2 className="text-3xl md:text-4xl font-bold text-center mb-8">
                  Stay Connected. Don't Miss Anything
                </h2>
                <div className="text-center space-y-2">
                  <p className="text-gray-400 mb-8">
                    Follow us for updates, challenges, and campus events:
                  </p>
                  <GlassIcons
                    items={[
                      {
                        icon: (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <rect
                              width="20"
                              height="20"
                              x="2"
                              y="2"
                              rx="5"
                              ry="5"
                            />
                            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                            <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                          </svg>
                        ),
                        label: "Instagram",
                        color: "red",
                        href: "https://www.instagram.com/letushackofficial/",
                        customClass: "cursor-pointer",
                      },
                      {
                        icon: (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                            <rect width="4" height="12" x="2" y="9" />
                            <circle cx="4" cy="4" r="2" />
                          </svg>
                        ),
                        label: "LinkedIn",
                        color: "red",
                        href: "https://www.linkedin.com/company/letushackofficial/",
                        customClass: "cursor-pointer",
                      },
                      {
                        icon: (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
                            <path d="m10 15 5-3-5-3z" />
                          </svg>
                        ),
                        label: "YouTube",
                        color: "red",
                        href: "https://youtube.com/@letushackofficial?si=AO79Tw55QkjTG1Be",
                        customClass: "cursor-pointer",
                      },
                      {
                        icon: (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
                          </svg>
                        ),
                        label: "Discord",
                        color: "red",
                        href: "https://discord.gg/RKZdqvw8FZ",
                        customClass: "cursor-pointer",
                      },
                    ]}
                    className="justify-center"
                  />
                </div>
              </div>
            </section>
          </div>{" "}
          {/* Final Content Section */}
          <div
            className="px-6 max-w-7xl mx-auto py-20 pb-32"
            data-scroll-section
          >
            {/* Know the team */}
            <section className="text-center mb-16" data-scroll-section>
              <p className="text-gray-200 text-xl md:text-2xl font-medium mt-4">
                Engineered with passion for the innovators of
                <br />
              </p>
            </section>
            {/* College Logos */}
            <div className="flex justify-center gap-8 flex-wrap mb-16 pb-16">
              <img
                src="/kmit.jpeg"
                alt="KMIT"
                className="h-16 object-contain grayscale hover:grayscale-0 transition"
              />
              <img
                src="/ngit.jpeg"
                alt="NGIT"
                className="h-16 object-contain grayscale hover:grayscale-0 transition"
              />
              <img
                src="/kmec.jpeg"
                alt="KMEC"
                className="h-16 object-contain grayscale hover:grayscale-0 transition"
              />
              <img
                src="/kmce.jpeg"
                alt="KMCE"
                className="h-16 object-contain grayscale hover:grayscale-0 transition"
              />
            </div>
          </div>
        </div>
      </main>
    </ReactLenis>
  );
}
