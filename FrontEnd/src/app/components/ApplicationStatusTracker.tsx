import { CheckCircle, Clock, FileCheck, Award, Loader2 } from "lucide-react";
import { Badge } from "./ui/badge";

interface TrackerStep {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  status: "completed" | "current" | "pending";
  timestamp?: string | null;
  subLabel?: string | null;
}

interface ApplicationStatusTrackerProps {
  applicationStatus: string;
  submittedAt: string;
  finalScreening?: {
    // Legacy fields
    scheduledDate?: string;
    scheduledTime?: string;
    // New video submission fields
    videoSubmissionType?: "recorded";
    googleDriveLink?: string;
    submissionDeadline?: string;
  } | null;
  stage?: "initial" | "accepted" | "completed";
}

export function ApplicationStatusTracker({
  applicationStatus,
  submittedAt,
  finalScreening,
  stage,
}: ApplicationStatusTrackerProps) {
  // Determine current step based on status and stage
  const getCurrentStep = (): number => {
    switch (applicationStatus) {
      case "Approved":
        return 4;
      case "Qualified for Final Screening":
        return 3;
      case "Under Review":
      case "System Qualified":
        return 2;
      case "Pending":
      case "Action Required: Submit Specific Requirements":
        return stage === "accepted" ? 3 : 1;
      case "Needs Resubmission":
        return 1;
      case "Rejected":
        return -1; // Special case
      default:
        return 1;
    }
  };

  const currentStep = getCurrentStep();
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const steps: TrackerStep[] = [
    {
      id: 1,
      title: "Application Submitted",
      description: "Profile documents linked successfully",
      icon: <CheckCircle className="h-5 w-5" />,
      status: currentStep >= 1 ? "completed" : "pending",
      timestamp: formatDate(submittedAt),
      subLabel: currentStep === 1 ? "Pending admin review" : null,
    },
    {
      id: 2,
      title: "Under Evaluation",
      description: "System analyzing eligibility & ranking",
      icon: <Loader2 className="h-5 w-5" />,
      status: currentStep === 2 ? "current" : currentStep > 2 ? "completed" : "pending",
      timestamp: currentStep > 2 ? "Completed" : null,
      subLabel: currentStep === 2 ? "Gale-Shapley matching in progress" : null,
    },
    {
      id: 3,
      title: "Qualified for Final Screening",
      description: "Stage 1 approved - specific docs required",
      icon: <FileCheck className="h-5 w-5" />,
      status: currentStep === 3 ? "current" : currentStep > 3 ? "completed" : "pending",
      timestamp: finalScreening?.submissionDeadline
        ? formatDate(finalScreening.submissionDeadline)
        : finalScreening?.scheduledDate
          ? formatDate(finalScreening.scheduledDate)
          : null,
      subLabel: currentStep === 3
        ? finalScreening?.googleDriveLink
          ? `Video submission due ${formatDate(finalScreening.submissionDeadline) || "TBD"}`
          : finalScreening?.scheduledDate
            ? `Screening scheduled for ${formatDate(finalScreening.scheduledDate)}`
            : "Submit scholarship-specific documents"
        : null,
    },
    {
      id: 4,
      title: "Slot Secured & Awarded",
      description: "Scholarship officially granted",
      icon: <Award className="h-5 w-5" />,
      status: currentStep === 4 ? "current" : "pending",
      timestamp: applicationStatus === "Approved" ? new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null,
      subLabel: applicationStatus === "Approved" ? "Congratulations!" : null,
    },
  ];

  // Handle rejected state
  if (applicationStatus === "Rejected") {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <Clock className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h4 className="font-semibold text-red-800">Application Not Selected</h4>
            <p className="text-sm text-red-600">
              Unfortunately, your application was not selected for this scholarship cycle.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="relative">
        {/* Progress Line - Desktop (horizontal) */}
        <div className="hidden md:block absolute top-5 left-0 right-0 h-0.5 bg-gray-200">
          <div
            className="h-full bg-green-500 transition-all duration-500"
            style={{
              width: `${Math.max(0, Math.min(100, ((currentStep - 1) / 3) * 100))}%`,
            }}
          />
        </div>

        {/* Progress Line - Mobile (vertical) */}
        <div className="md:hidden absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200">
          <div
            className="w-full bg-green-500 transition-all duration-500"
            style={{
              height: `${Math.max(0, Math.min(100, ((currentStep - 1) / 3) * 100))}%`,
            }}
          />
        </div>

        {/* Steps */}
        <div className="relative grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-4">
          {steps.map((step, index) => {
            const isCompleted = step.status === "completed";
            const isCurrent = step.status === "current";
            const isPending = step.status === "pending";

            return (
              <div
                key={step.id}
                className={`relative flex md:flex-col items-start md:items-center gap-3 md:gap-2 ${
                  isPending ? "opacity-50" : ""
                }`}
              >
                {/* Circle Icon */}
                <div
                  className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                    isCompleted
                      ? "bg-green-500 text-white"
                      : isCurrent
                      ? "bg-blue-500 text-white ring-4 ring-blue-200 animate-pulse"
                      : "bg-gray-200 text-gray-400"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    step.icon
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 md:text-center">
                  <h4
                    className={`font-semibold text-sm ${
                      isCompleted
                        ? "text-green-700"
                        : isCurrent
                        ? "text-blue-700"
                        : "text-gray-500"
                    }`}
                  >
                    {step.title}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {step.description}
                  </p>

                  {/* Timestamp or Status Label */}
                  {step.timestamp && (
                    <Badge
                      variant="outline"
                      className={`mt-2 text-xs ${
                        isCompleted
                          ? "bg-green-50 text-green-700 border-green-200"
                          : isCurrent
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-gray-50 text-gray-500"
                      }`}
                    >
                      {isCompleted ? "✓ " : ""}
                      {step.timestamp}
                    </Badge>
                  )}

                  {/* Dynamic Sub-label */}
                  {step.subLabel && (
                    <p
                      className={`text-xs mt-1.5 font-medium ${
                        isCurrent ? "text-blue-600 animate-pulse" : "text-muted-foreground"
                      }`}
                    >
                      {isCurrent && <span className="inline-block w-1.5 h-1.5 bg-blue-500 rounded-full mr-1.5 animate-pulse" />}
                      {step.subLabel}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
