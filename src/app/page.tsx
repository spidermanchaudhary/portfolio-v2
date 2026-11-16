import Hero from "@/components/sections/Hero";
import Origin from "@/components/sections/Origin";
import Toolbox from "@/components/sections/Toolbox";
import Worlds from "@/components/sections/Worlds";
import Signals from "@/components/sections/Signals";
import Launch from "@/components/sections/Launch";
import Colophon from "@/components/sections/Colophon";
import { getProjects, getSkills } from "@/data/load";
import { reviews } from "@/data/reviews";
import { site, socials } from "@/data/site";
import { origin } from "@/data/origin";

export const revalidate = 3600;

export default async function Home() {
  const [projects, skills] = await Promise.all([getProjects(), getSkills()]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        "@id": `${site.url}/#person`,
        name: site.name,
        url: site.url,
        jobTitle: site.role,
        description: origin[0].body,
        image: `${site.url}/hero.jpg`,
        email: "mailto:me@sujal.info",
        address: { "@type": "PostalAddress", addressLocality: "New Delhi", addressCountry: "IN" },
        alumniOf: {
          "@type": "CollegeOrUniversity",
          name: "Netaji Subhas University of Technology",
          alternateName: "NSUT",
        },
        knowsAbout: skills.map((s) => s.name),
        sameAs: socials.map((s) => s.href),
      },
      {
        "@type": "WebSite",
        "@id": `${site.url}/#website`,
        url: site.url,
        name: site.name,
        author: { "@id": `${site.url}/#person` },
      },
      {
        "@type": "ItemList",
        name: "Projects",
        itemListElement: projects.map((p, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: {
            "@type": "SoftwareApplication",
            name: p.name,
            description: p.tagline,
            url: p.demoLink || `${site.url}/work/${p.slug}`,
            applicationCategory: "WebApplication",
            operatingSystem: "Web",
            image: p.thumbnail,
            author: { "@id": `${site.url}/#person` },
          },
        })),
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Hero />
      <Origin />
      <Toolbox skills={skills} />
      <Worlds projects={projects} />
      <Signals reviews={reviews} />
      <Launch />
      <Colophon />
    </>
  );
}
