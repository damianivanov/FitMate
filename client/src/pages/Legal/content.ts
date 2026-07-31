export type LegalTable = {
  columns: string[];
  rows: string[][];
};

export type LegalSubsection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  table?: LegalTable;
};

export type LegalSection = {
  id: string;
  title: string;
  subsections: LegalSubsection[];
};

export const legalEffectiveDate = "31 July 2026";
export const legalContactEmail = "damian.ivanovv@gmail.com";

// Operator identification is commented out until the entity details are decided.
// EU law (Bulgarian E-Commerce Act art. 4) requires the operator's name and a
// physical address to be published, so uncomment these — and the blocks marked
// "operator details" below — before public launch.
// const operatorName = "[[OPERATOR_NAME]]";
// const operatorAddress = "[[OPERATOR_ADDRESS]]";
// const operatorVat = "[[VAT_OR_EIK]]";

export const legalSections: LegalSection[] = [
  {
    id: "terms",
    title: "Terms of Service",
    subsections: [
      {
        heading: "Agreement",
        paragraphs: [
          // operator details: restore `${operatorName}` in place of "the operator of FitMate"
          "These terms are an agreement between you and the operator of FitMate (\"FitMate\", \"we\", \"us\"). By creating an account or using FitMate you agree to them. If you do not agree, please do not use the service.",
          "We may update these terms as the service changes. When we make a material change we will make the updated terms available here with a new effective date. Continuing to use FitMate after that means you accept the change.",
        ],
      },
      {
        heading: "Eligibility",
        paragraphs: [
          "You must be at least 16 years old to use FitMate. By using the service you confirm you meet this requirement and that the information you give us is accurate.",
        ],
      },
      {
        heading: "Your account",
        paragraphs: [
          "You are responsible for keeping your password secure and for everything that happens under your account. Tell us promptly at the contact address below if you believe someone else has accessed it.",
          "You may sign in with email and password or with Google. If you use Google sign-in, you are also bound by Google's own terms for that service.",
        ],
      },
      {
        heading: "Subscriptions and billing",
        paragraphs: [
          "FitMate offers both free and paid plans. Paid plans are billed in advance on a recurring basis through our payment provider, and renew automatically until cancelled.",
          "Prices are shown before you subscribe. If we change the price of a plan you are on, we will tell you before the change applies to your next renewal, so you can cancel if you prefer.",
          "We do not receive or store your card details. Payments are handled entirely by our payment provider.",
        ],
      },
      {
        heading: "AI features and fair use",
        paragraphs: [
          "Paid plans include AI coaching features subject to usage limits, which are shown in the app. Limits exist so that the service stays available and affordable for everyone; we may adjust them, and will do so transparently.",
          "AI features depend on a third-party provider. If that provider is unavailable, AI features may be temporarily degraded or unavailable while the rest of FitMate continues to work.",
        ],
      },
      {
        heading: "Acceptable use",
        paragraphs: ["You agree not to:"],
        bullets: [
          "use FitMate for anything unlawful, or to harm or harass anyone",
          "attempt to access accounts, data, or systems that are not yours",
          "probe, scan, overload, or disrupt the service or its infrastructure",
          "scrape, resell, or redistribute the service or its content",
          "use AI features to generate unlawful, abusive, or deliberately harmful content",
          "misrepresent AI-generated guidance as professional medical or clinical advice",
        ],
      },
      {
        heading: "Your content",
        paragraphs: [
          "Your workouts, exercises, programmes, notes, images, and measurements remain yours. You grant us only the permission needed to operate the service for you: to store this content, process it, display it back to you, and pass the relevant parts to the sub-processors listed in the Privacy Policy.",
          "We do not sell your content and we do not use it to train third-party AI models.",
        ],
      },
      {
        heading: "Availability",
        paragraphs: [
          "We work to keep FitMate available and accurate, but we provide it on an \"as is\" and \"as available\" basis. We do not guarantee uninterrupted access, and we may change, suspend, or discontinue features.",
        ],
      },
      {
        heading: "Termination",
        paragraphs: [
          "You may stop using FitMate at any time. We may suspend or close an account that breaches these terms, that is used unlawfully, or where required by law. Where it is reasonable to do so, we will tell you first.",
        ],
      },
      {
        heading: "Liability",
        paragraphs: [
          "Nothing in these terms limits liability that cannot be limited by law, including liability for death or personal injury caused by negligence, or for fraud.",
          "Subject to that, and to the extent permitted by law, our total liability arising out of your use of FitMate is limited to the amount you paid us in the twelve months before the claim. We are not liable for indirect or consequential loss, or for loss of data beyond our reasonable control.",
          "Please also read the Medical and AI Disclaimer below, which forms part of these terms.",
        ],
      },
      {
        heading: "Governing law",
        paragraphs: [
          "These terms are governed by the laws of the Republic of Bulgaria. Disputes fall to the competent Bulgarian courts. If you are a consumer, this does not deprive you of the protection of mandatory rules in your country of residence, nor of your right to use an out-of-court dispute resolution scheme.",
        ],
      },
    ],
  },

  {
    id: "disclaimer",
    title: "Medical & AI Disclaimer",
    subsections: [
      {
        heading: "FitMate is not medical advice",
        paragraphs: [
          "FitMate is a fitness tracking and training tool. It is not a medical device, and nothing in it — including AI-generated programmes, suggestions, or explanations — is medical, diagnostic, or clinical advice. We are not your physician, physiotherapist, or dietitian.",
          "Never disregard professional medical advice, or delay seeking it, because of something you read in FitMate.",
        ],
      },
      {
        heading: "Speak to a professional first",
        paragraphs: [
          "Consult a qualified healthcare professional before starting any new training programme, especially if you are pregnant, recovering from injury or surgery, living with a cardiovascular, respiratory, metabolic, or musculoskeletal condition, taking medication that affects exercise capacity, or returning to training after a long break.",
        ],
      },
      {
        heading: "You assume the risk of training",
        paragraphs: [
          "Physical exercise carries an inherent risk of injury. You are solely responsible for how you train: for the loads you select, your technique, your equipment, your environment, and for judging whether any suggested session is appropriate for you on the day.",
          "Stop immediately and seek medical attention if you experience chest pain, dizziness, faintness, severe shortness of breath, or sharp or persistent pain. In an emergency, call your local emergency number — do not use FitMate to seek help.",
        ],
      },
      {
        heading: "AI guidance can be wrong",
        paragraphs: [
          "FitMate's AI features are generated by a large language model. They can be inaccurate, incomplete, or unsuitable for your circumstances, and they can state incorrect things confidently. Treat AI output as a starting point that requires your own judgement, not as an instruction to follow.",
          "AI suggestions are based on the information in your account. If that information is incomplete or out of date, the output will reflect that.",
        ],
      },
    ],
  },

  {
    id: "privacy",
    title: "Privacy Policy",
    subsections: [
      {
        heading: "Who is responsible for your data",
        paragraphs: [
          // operator details: restore `${operatorName}, ${operatorAddress}, is the data controller`
          `The operator of FitMate is the data controller for personal data processed in the app. For any privacy question or request, contact ${legalContactEmail}.`,
        ],
      },
      {
        heading: "What we collect",
        bullets: [
          "Account data — name, email address, password hash, and your Google account identifier if you use Google sign-in.",
          "Training data — workouts, exercises, sets, repetitions, loads, templates, programmes, personal records, and notes you write.",
          "Health data — body weight, body fat percentage, and your training profile, including experience level, goals, injuries, and limitations you choose to record.",
          "AI conversations — the messages you send to the AI coach and its replies.",
          "Technical data — authentication tokens, and error diagnostics when something goes wrong.",
          "Billing data — subscription status and plan. Card details are handled by our payment provider and never reach our servers.",
        ],
      },
      {
        heading: "Health data deserves special mention",
        paragraphs: [
          "Body measurements, injuries, and physical limitations are health data — a special category under Article 9 of the GDPR that receives stronger protection. We process it only on the basis of your explicit consent, given when you choose to record it, and only to provide the tracking and coaching features you are using.",
          "Recording this data is always optional. You can use FitMate to log workouts without entering any health information, and you can remove entries you have already recorded.",
        ],
      },
      {
        heading: "Why we process it, and on what basis",
        table: {
          columns: ["Purpose", "Legal basis"],
          rows: [
            ["Creating and running your account", "Performance of our contract with you"],
            ["Storing and displaying your workouts and programmes", "Performance of our contract with you"],
            ["Body measurements and training-profile health data", "Your explicit consent (Art. 9(2)(a))"],
            ["Generating AI coaching responses", "Performance of our contract with you"],
            ["Taking payment and managing subscriptions", "Performance of our contract with you"],
            ["Keeping the service secure and diagnosing faults", "Our legitimate interest in a working, secure service"],
            ["Meeting tax and accounting obligations", "Compliance with a legal obligation"],
          ],
        },
      },
      {
        heading: "Who else processes your data",
        paragraphs: [
          "We use a small number of sub-processors to run FitMate. Each acts on our instructions under a data processing agreement.",
        ],
        table: {
          columns: ["Sub-processor", "What it does", "What it receives"],
          rows: [
            [
              "OpenAI",
              "AI coaching replies and exercise image generation",
              "The content of your AI conversations and the training context relevant to your request",
            ],
            [
              "Google",
              "Sign-in with Google",
              "Your Google account identifier and basic profile, only if you use Google sign-in",
            ],
            [
              "Stripe",
              "Subscription payments",
              "Your email address and subscription details; card data goes directly to Stripe",
            ],
            [
              "Microsoft Azure",
              "Hosting and exercise image storage",
              "Data stored and served by the application",
            ],
          ],
        },
      },
      {
        heading: "What we send to the AI provider",
        paragraphs: [
          "When you use an AI feature, the relevant part of your training context is sent to OpenAI so it can generate a reply. Before anything leaves our servers it passes through a redaction step that strips credentials and authentication tokens.",
          "We do not permit your data to be used to train the provider's models. If you never use the AI features, nothing is sent to OpenAI at all.",
        ],
      },
      {
        heading: "Transfers outside the EU",
        paragraphs: [
          "Some sub-processors are established in the United States. Where data is transferred outside the European Economic Area, the transfer is covered by the European Commission's Standard Contractual Clauses or another lawful transfer mechanism.",
        ],
      },
      {
        heading: "How long we keep it",
        paragraphs: [
          "We keep your account and training data for as long as your account exists, so that your history remains available to you. Error diagnostics are kept for a limited period for troubleshooting. Invoicing records are kept for as long as tax law requires.",
          "If you ask us to delete your account, we remove your personal data except where we are legally required to retain it.",
        ],
      },
      {
        heading: "Your rights",
        paragraphs: [
          `Under the GDPR you can ask for a copy of your data, correct it, have it deleted, restrict or object to how we use it, receive it in a portable format, and withdraw any consent you have given — withdrawal does not affect processing that already happened. Write to ${legalContactEmail} and we will respond within one month.`,
          "If you believe we have handled your data improperly, you can complain to the Bulgarian Commission for Personal Data Protection, or to the supervisory authority where you live.",
        ],
      },
      {
        heading: "Security",
        paragraphs: [
          "Passwords are stored hashed, never in plain text. Sessions use signed tokens in HTTP-only cookies, which prevents scripts in the browser from reading them. Traffic is encrypted in transit. No system is perfectly secure, but we take these measures seriously and improve them as the service grows.",
        ],
      },
    ],
  },

  {
    id: "cookies",
    title: "Cookie Policy",
    subsections: [
      {
        heading: "What we actually store",
        paragraphs: [
          "FitMate uses a deliberately small number of cookies and browser storage entries, all of which are needed for the app to work. We do not use analytics cookies, advertising cookies, or cross-site tracking of any kind.",
        ],
        table: {
          columns: ["Name", "Set by", "Purpose", "Duration", "Type"],
          rows: [
            ["Token", "FitMate", "Keeps you signed in", "Session", "Essential"],
            ["RefreshToken", "FitMate", "Renews your session without making you sign in again", "Persistent", "Essential"],
            ["fitmate-theme", "FitMate", "Remembers light or dark mode", "Persistent", "Essential"],
            ["fitmate-cookie-consent", "FitMate", "Remembers your choice on this banner", "Persistent", "Essential"],
            ["Workout drafts", "FitMate", "Recovers an in-progress workout if the app closes", "Persistent", "Essential"],
            ["g_state", "Google", "Sign-in with Google", "Persistent", "Essential"],
            ["__stripe_mid, __stripe_sid", "Stripe", "Payment fraud prevention", "Session and persistent", "Essential"],
          ],
        },
      },
      {
        heading: "Why you still see a banner",
        paragraphs: [
          "Everything above is strictly necessary, which under EU rules does not require your consent. We show the banner anyway so that the position is transparent, and so the mechanism is in place should we ever introduce optional cookies. If that happens, they will be off until you turn them on.",
        ],
      },
      {
        heading: "Changing your mind",
        paragraphs: [
          "Use the \"Cookie preferences\" link in the footer or in your account menu to reopen the banner and change your choice at any time. You can also clear cookies and site data in your browser settings, though signing out is a side effect of doing so.",
        ],
      },
    ],
  },

  {
    id: "refunds",
    title: "Refund & Cancellation",
    subsections: [
      {
        heading: "Cancelling",
        paragraphs: [
          "You can cancel a paid plan at any time from your subscription settings. Cancellation stops the next renewal; your plan stays active until the end of the period you have already paid for, and then reverts to the free plan. Your training history is not deleted when a subscription ends.",
        ],
      },
      {
        heading: "Your 14-day right of withdrawal",
        paragraphs: [
          "As an EU consumer you normally have 14 days to withdraw from a distance contract without giving a reason.",
          "Because FitMate is digital content supplied immediately, you are asked to confirm at checkout that you want access to start straight away and that you acknowledge you thereby lose the right of withdrawal once supply has begun. This is required by Article 16(m) of the Consumer Rights Directive.",
          `If you have not yet used any paid feature in the current period, write to ${legalContactEmail} and we will refund you regardless.`,
        ],
      },
      {
        heading: "Refunds",
        paragraphs: [
          "We refund duplicate charges and billing errors in full. If the service is materially broken for an extended period and we cannot fix it, contact us and we will put it right.",
          "Refunds are returned to the original payment method, usually within 5–10 business days depending on your bank.",
        ],
      },
    ],
  },

  {
    id: "imprint",
    title: "Legal Notice",
    subsections: [
      {
        heading: "Service operator",
        bullets: [
          // operator details: uncomment once the entity is decided
          // `Operator: ${operatorName}`,
          // `Registered address: ${operatorAddress}`,
          // `VAT / EIK: ${operatorVat}`,
          `Email: ${legalContactEmail}`,
        ],
      },
      {
        heading: "Dispute resolution",
        paragraphs: [
          "We would rather resolve any problem directly, so please write to us first. EU consumers may also use the European Commission's online dispute resolution platform, or the Bulgarian Commission for Consumer Protection.",
        ],
      },
    ],
  },
];
