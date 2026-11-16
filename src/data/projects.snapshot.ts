/**
 * Raw snapshot of GET {API}/api/portfolio/projects (taken 2026-11-16).
 * Descriptions are verbatim. Build-time fallback for `load.ts`.
 */
export interface ApiProject {
  _id: string;
  name: string;
  description: string;
  thumbnail: string;
  demoLink?: string;
  sourceCodeLink?: string;
}

export const projectsSnapshot: ApiProject[] = [
  {
    "_id": "6856addebcdbacf66e86be72",
    "name": "NSUT Rollno Search",
    "description": "This innovative tool, developed to simplify the process of locating student roll numbers at NSUT, has assisted over 1,000 students in finding their roll numbers with ease. As a crucial resource, it leverages a powerful combination of HTML, CSS, JavaScript, and PHP to deliver a seamless and efficient user experience.\nThis project exemplifies my commitment to creating practical and impactful solutions, demonstrating my proficiency in both frontend and backend development.",
    "thumbnail": "https://res.cloudinary.com/dntyqrmid/image/upload/v1778859780/drive/files/b93178860edd1e46b0db2a0a2ba028d8.png",
    "demoLink": "https://rollno.sujal.info/",
    "sourceCodeLink": "https://sujal.info/rollnoSearchSourceCode"
  },
  {
    "_id": "6856addebcdbacf66e86be79",
    "name": "WTF",
    "description": "WTF (What a True Feedback) is an innovative platform that lets users create profiles and receive anonymous feedback from others. With a unique shareable link, users can invite friends, peers, or anyone to share their thoughts openly, fostering honest and constructive communication. Built using the MERN stack (MongoDB, Express.js, React, and Node.js), the platform ensures seamless performance and a dynamic user experience.\n\nIt integrates Socket.IO for real-time messaging, JSON Web Tokens (JWT) for secure authentication, and follows modern web development practices. WTF is the perfect tool for those seeking genuine, unfiltered opinions to grow and improve.",
    "thumbnail": "https://res.cloudinary.com/dntyqrmid/image/upload/v1778859780/drive/files/659bbc91e6c69694fe6e34acf32b27d6.png",
    "demoLink": "https://wtf.techpi.me",
    "sourceCodeLink": "https://github.com/sujallchaudhary/wtf"
  },
  {
    "_id": "6856addebcdbacf66e86be74",
    "name": "Sdrive",
    "description": "I developed SDrive, a dynamic cloud storage service that offers users the flexibility to store and access a wide range of file types from anywhere. SDrive is built to cater to different user needs with two distinct account types public and private which allows to store files securely.\nit have various features like file sharing, folder creation, easy sorting and searching, multiple accounts and many more.\ncredentials for demo:username:demopassword: demo123",
    "thumbnail": "https://res.cloudinary.com/dntyqrmid/image/upload/v1778859780/drive/files/18f9f9b40e66d48109dac146462ca3ed.png",
    "demoLink": "https://drive.sujal.info",
    "sourceCodeLink": ""
  },
  {
    "_id": "6856addebcdbacf66e86be73",
    "name": "Jee College Predictor",
    "description": "Developed in collaboration with TEAMGTC, this innovative project has transformed the college search journey for over 400,000 students. As a top-ranked college predictor on Google, it combines a user-friendly interface with powerful backend technology to help students find their ideal college effortlessly. This project highlights my expertise in full-stack development and my commitment to creating impactful, user-focused solutions.",
    "thumbnail": "https://res.cloudinary.com/dntyqrmid/image/upload/v1778859780/drive/files/93f7e08f72ca3e3a02658e02d42b0be0.png",
    "demoLink": "https://teamgtc.live/predictor/",
    "sourceCodeLink": ""
  },
  {
    "_id": "6856addebcdbacf66e86be7a",
    "name": "BlindBook",
    "description": "BlindBook is a secure, anonymous social platform designed for college students to connect, share, and communicate freely. It offers a judgment-free space to build meaningful connections while maintaining user privacy through end-to-end encryption. BlindBook is powered by the MERN stack (MongoDB, Express.js, React, Node.js) and integrates Socket.IO for real-time interactions, FCM for instant notifications, Mailgun for seamless email delivery, and AWS S3 for secure data storage. With a focus on creating a safe and engaging user experience, BlindBook provides a trusted platform for authentic conversations and connections.",
    "thumbnail": "https://res.cloudinary.com/dntyqrmid/image/upload/v1778859780/drive/files/ed76ef5bcffe0556eb050d1bbd1872ff.png",
    "demoLink": "https://blindbook.me",
    "sourceCodeLink": ""
  },
  {
    "_id": "6856addebcdbacf66e86be78",
    "name": "NSUT Students Directory",
    "description": "NSUT Student Directory - A comprehensive resource for accessing student information and contact details at Netaji Subhas University of Technology.\nThis cutting-edge platform, designed to streamline access to student information at NSUT. Serving as an essential tool, it harnesses the robust capabilities of HTML, CSS, JavaScript, and PHP to provide a smooth and efficient user experience. This project highlights my dedication to crafting effective and meaningful solutions, showcasing my expertise in both frontend and backend development.",
    "thumbnail": "https://res.cloudinary.com/dntyqrmid/image/upload/v1778859780/drive/files/6c985400db4ecb9a98d340b15951a01c.png",
    "demoLink": "https://nsutdir.sujal.info/",
    "sourceCodeLink": ""
  },
  {
    "_id": "68f871ea910907fc9fd765ee",
    "name": "Hajiri",
    "description": "Hajiri is an attendance automation system built for NSUT students, reducing attendance checking from 3-5 minutes to 1-2 seconds. Available as a chatbot and website, it web-scrapes the college portal using student credentials, solving CAPTCHAs via Tesseract OCR. With 4000+ users, 1500+ daily active users, and 5000-6000 daily fetches, it serves 40% of NSUT's 10k student base. Built with Next.js, Node.js, MongoDB, Cheerio, JWT, and Azure Blob Storage, it delivers instant, secure attendance access through a simple \"hi\" message or web dashboard, saving thousands of student-hours daily.",
    "thumbnail": "https://res.cloudinary.com/dntyqrmid/image/upload/v1783446837/Screenshot_2026-07-07_at_11.23.05_PM_xqa4ao.png",
    "demoLink": "https://www.hajiri.app",
    "sourceCodeLink": ""
  }
];
