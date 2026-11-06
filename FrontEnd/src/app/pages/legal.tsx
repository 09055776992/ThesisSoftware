import { Link } from "react-router";
import { ArrowLeft, GraduationCap } from "lucide-react";

type LegalPageProps = {
  title: string;
  description: string;
  sections: Array<{ heading: string; body: string }>;
};

function LegalPage({ title, description, sections }: LegalPageProps) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <article className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-sm sm:p-10">
        <Link
          to="/auth/signup"
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline"
        >
          <ArrowLeft className="size-4" />
          Back to registration
        </Link>
        <div className="mb-8 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-blue-600">
            <GraduationCap className="size-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="text-sm text-slate-500">{description}</p>
          </div>
        </div>
        <div className="space-y-6 text-sm leading-6 text-slate-600">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="mb-2 text-base font-semibold text-slate-900">{section.heading}</h2>
              <p>{section.body}</p>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}

export function TermsOfService() {
  return (
    <LegalPage
      title="Terms of Service"
      description="General terms for using SCHOLAR."
      sections={[
        {
          heading: "Using SCHOLAR",
          body: "SCHOLAR helps students discover and manage scholarship opportunities. You are responsible for providing accurate information and keeping your account credentials private.",
        },
        {
          heading: "Applications and information",
          body: "Scholarship requirements, deadlines, and decisions are provided by the relevant scholarship provider. Always review the provider's instructions before submitting an application.",
        },
        {
          heading: "Acceptable use",
          body: "Do not submit fraudulent documents, impersonate another person, interfere with the service, or use SCHOLAR for unlawful purposes.",
        },
      ]}
    />
  );
}

export function PrivacyPolicy() {
  return (
    <LegalPage
      title="Privacy Policy"
      description="How SCHOLAR handles information in the application."
      sections={[
        {
          heading: "Information we use",
          body: "SCHOLAR uses account, academic, contact, and application information to provide matching, application tracking, notifications, and related platform features.",
        },
        {
          heading: "Uploaded documents",
          body: "Documents are used to support scholarship applications and eligibility workflows. Only upload documents that belong to you or that you are authorized to provide.",
        },
        {
          heading: "Your choices",
          body: "You may review and update profile information through the application. Contact the system administrator if you need help correcting or removing information.",
        },
      ]}
    />
  );
}
