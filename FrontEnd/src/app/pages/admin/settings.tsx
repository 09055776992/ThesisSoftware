import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Switch } from "../../components/ui/switch";
import { Separator } from "../../components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { toast } from "sonner";
import { fetchAdminSettings, regenerateAdminApiKey, updateAdminSettings, type AdminSettings as AdminSettingsData } from "../../lib/api-client";
import { Loader2 } from "lucide-react";

export function AdminSettings() {
  const [platformName, setPlatformName] = useState("");
  const [tagline, setTagline] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [description, setDescription] = useState("");
  const [welcomeEmail, setWelcomeEmail] = useState("");
  const [approvalEmail, setApprovalEmail] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [applicationsEnabled, setApplicationsEnabled] = useState(true);
  const [socialEnabled, setSocialEnabled] = useState(true);
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(true);
  const [newScholarshipAlertsEnabled, setNewScholarshipAlertsEnabled] = useState(true);
  const [applicationStatusUpdatesEnabled, setApplicationStatusUpdatesEnabled] = useState(true);
  const [deadlineRemindersEnabled, setDeadlineRemindersEnabled] = useState(true);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminSettings()
      .then(({ data }) => {
        setPlatformName(data.platformName);
        setTagline(data.tagline);
        setSupportEmail(data.supportEmail);
        setDescription(data.description);
        setWelcomeEmail(data.welcomeEmail);
        setApprovalEmail(data.approvalEmail);
        setApiKey(data.apiKey);
        setWebhookUrl(data.webhookUrl);
        setRegistrationEnabled(data.registrationEnabled);
        setApplicationsEnabled(data.applicationsEnabled);
        setSocialEnabled(data.socialEnabled);
        setEmailNotificationsEnabled(data.emailNotificationsEnabled);
        setNewScholarshipAlertsEnabled(data.newScholarshipAlertsEnabled);
        setApplicationStatusUpdatesEnabled(data.applicationStatusUpdatesEnabled);
        setDeadlineRemindersEnabled(data.deadlineRemindersEnabled);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Failed to load settings."))
      .finally(() => setLoading(false));
  }, []);

  const save = async (section: "general" | "templates" | "api") => {
    const values: Partial<AdminSettingsData> = section === "general"
      ? {
          platformName,
          tagline,
          supportEmail,
          description,
          registrationEnabled,
          applicationsEnabled,
          socialEnabled,
          emailNotificationsEnabled,
          newScholarshipAlertsEnabled,
          applicationStatusUpdatesEnabled,
          deadlineRemindersEnabled,
        }
      : section === "templates"
        ? { welcomeEmail, approvalEmail }
        : { apiKey, webhookUrl };
    try {
      setSavingSection(section);
      const result = await updateAdminSettings(section, values);
      if (result.data?.apiKey) setApiKey(result.data.apiKey);
      toast.success(`${section === "templates" ? "Email templates" : section === "api" ? "API settings" : "Platform settings"} saved.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings.");
    } finally {
      setSavingSection(null);
    }
  };

  const handleRegenerateApiKey = async () => {
    if (!window.confirm("Are you sure you want to regenerate the API key? Existing integrations using the current key will stop working.")) return;
    try {
      setSavingSection("regenerate");
      const result = await regenerateAdminApiKey();
      setApiKey(result.apiKey);
      toast.success("API key regenerated. Copy the new key before leaving this page.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to regenerate API key.");
    } finally {
      setSavingSection(null);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-4 md:space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">System Settings</h1>
        <p className="text-muted-foreground">Configure platform settings and preferences</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="email">Email Templates</TabsTrigger>
          <TabsTrigger value="api">API Keys</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Platform Information</CardTitle>
              <CardDescription>Basic platform settings and information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="platform-name">Platform Name</Label>
                <Input id="platform-name" value={platformName} onChange={(event) => setPlatformName(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tagline">Tagline</Label>
                <Input id="tagline" value={tagline} onChange={(event) => setTagline(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="support-email">Support Email</Label>
                <Input id="support-email" type="email" value={supportEmail} onChange={(event) => setSupportEmail(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Platform Description</Label>
                <Textarea id="description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
              </div>
              <Button onClick={() => save("general")} disabled={loading || savingSection !== null}>
                {savingSection === "general" && <Loader2 className="size-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Feature Toggles</CardTitle>
              <CardDescription>Enable or disable platform features</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">User Registration</p>
                  <p className="text-sm text-muted-foreground">Allow new users to register</p>
                </div>
                <Switch checked={registrationEnabled} onCheckedChange={setRegistrationEnabled} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">Scholarship Applications</p>
                  <p className="text-sm text-muted-foreground">Enable scholarship application submissions</p>
                </div>
                <Switch checked={applicationsEnabled} onCheckedChange={setApplicationsEnabled} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">Social Features</p>
                  <p className="text-sm text-muted-foreground">Enable posts, comments, and social interactions</p>
                </div>
                <Switch checked={socialEnabled} onCheckedChange={setSocialEnabled} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">Email Notifications</p>
                  <p className="text-sm text-muted-foreground">Send automated email notifications</p>
                </div>
                <Switch checked={emailNotificationsEnabled} onCheckedChange={setEmailNotificationsEnabled} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>Configure when and how users receive notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">New Scholarship Alert</p>
                  <p className="text-sm text-muted-foreground">Notify users when new scholarships match their profile</p>
                </div>
                <Switch checked={newScholarshipAlertsEnabled} onCheckedChange={setNewScholarshipAlertsEnabled} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">Application Status Updates</p>
                  <p className="text-sm text-muted-foreground">Notify users of application status changes</p>
                </div>
                <Switch checked={applicationStatusUpdatesEnabled} onCheckedChange={setApplicationStatusUpdatesEnabled} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">Deadline Reminders</p>
                  <p className="text-sm text-muted-foreground">Send reminders for upcoming deadlines</p>
                </div>
                <Switch checked={deadlineRemindersEnabled} onCheckedChange={setDeadlineRemindersEnabled} />
              </div>
              <Button onClick={() => save("general")} disabled={loading || savingSection !== null}>
                {savingSection === "general" && <Loader2 className="size-4 mr-2 animate-spin" />}
                Save Notification Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Email Templates</CardTitle>
              <CardDescription>Customize automated email templates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="welcome-email">Welcome Email</Label>
                <Textarea id="welcome-email" rows={4} value={welcomeEmail} onChange={(event) => setWelcomeEmail(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="approval-email">Application Approval Email</Label>
                <Textarea id="approval-email" rows={4} value={approvalEmail} onChange={(event) => setApprovalEmail(event.target.value)} />
              </div>
              <Button onClick={() => save("templates")} disabled={loading || savingSection !== null}>
                {savingSection === "templates" && <Loader2 className="size-4 mr-2 animate-spin" />}
                Save Templates
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>API Key Management</CardTitle>
              <CardDescription>Manage API keys for external integrations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="api-key">Primary API Key</Label>
                <div className="flex gap-2">
                  <Input id="api-key" type="password" value={apiKey} readOnly />
                    <Button variant="outline" onClick={handleRegenerateApiKey} disabled={loading || savingSection !== null}>
                      {savingSection === "regenerate" && <Loader2 className="size-4 mr-2 animate-spin" />}
                      Regenerate
                    </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="webhook-url">Webhook URL</Label>
                <Input id="webhook-url" value={webhookUrl} onChange={(event) => setWebhookUrl(event.target.value)} placeholder="https://your-domain.com/webhook" />
              </div>
              <Button onClick={() => save("api")} disabled={loading || savingSection !== null}>
                {savingSection === "api" && <Loader2 className="size-4 mr-2 animate-spin" />}
                Save API Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
