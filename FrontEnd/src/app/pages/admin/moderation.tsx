import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";
import { Separator } from "../../components/ui/separator";
import { AlertTriangle, CheckCircle, XCircle } from "lucide-react";

const reportedContent = [
  {
    id: 1,
    type: "Post",
    author: "John Smith",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=report1",
    content: "This is a sample post that has been reported for review...",
    reportedBy: "User123",
    reason: "Inappropriate content",
    date: "Apr 14, 2026",
  },
  {
    id: 2,
    type: "Comment",
    author: "Jane Doe",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=report2",
    content: "Sample comment text that was flagged...",
    reportedBy: "User456",
    reason: "Spam",
    date: "Apr 15, 2026",
  },
];

export function AdminModeration() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Content Moderation</h1>
        <p className="text-muted-foreground">Review and manage reported content</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Review</p>
                <p className="text-3xl font-bold font-mono">24</p>
              </div>
              <AlertTriangle className="size-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-3xl font-bold font-mono">145</p>
              </div>
              <CheckCircle className="size-8 text-accent" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Removed</p>
                <p className="text-3xl font-bold font-mono">38</p>
              </div>
              <XCircle className="size-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reported Content Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {reportedContent.map((item) => (
              <div key={item.id}>
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <Avatar>
                      <AvatarImage src={item.avatar} />
                      <AvatarFallback>{item.author[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold">{item.author}</span>
                        <Badge variant="outline">{item.type}</Badge>
                        <span className="text-sm text-muted-foreground ml-auto">{item.date}</span>
                      </div>
                      <p className="text-muted-foreground mb-3">{item.content}</p>
                      <div className="flex items-center gap-2 text-sm">
                        <AlertTriangle className="size-4 text-amber-500" />
                        <span>
                          Reported by <span className="font-semibold">{item.reportedBy}</span> for:{" "}
                          <span className="text-destructive">{item.reason}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button className="bg-accent">
                      <CheckCircle className="size-4 mr-2" />
                      Approve Content
                    </Button>
                    <Button variant="destructive">
                      <XCircle className="size-4 mr-2" />
                      Remove Content
                    </Button>
                    <Button variant="outline">Warn User</Button>
                    <Button variant="outline">Ban User</Button>
                  </div>
                </div>
                {item.id !== reportedContent[reportedContent.length - 1].id && (
                  <Separator className="mt-6" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
