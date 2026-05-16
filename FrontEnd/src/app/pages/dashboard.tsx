import { useState } from "react";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Heart, MessageCircle, Share2, Bookmark, ImageIcon, FileText } from "lucide-react";
import { Separator } from "../components/ui/separator";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { getInitials, getStoredUser } from "../lib/user-storage";
import { resolvePublicAssetUrl, pickProfileImageUrl } from "../lib/api-client";

const mockPosts = [
  {
    id: 1,
    author: {
      name: "Sarah Johnson",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=sarah",
      headline: "Computer Science @ MIT",
    },
    timestamp: "2 hours ago",
    content: "Excited to announce that I've been awarded the Merit Scholarship from the National Science Foundation! This will help me continue my research in artificial intelligence and machine learning. Grateful for this opportunity! 🎓",
    image: "https://images.unsplash.com/photo-1762438135827-428acc0e8941?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdHVkZW50JTIwYWNoaWV2ZW1lbnQlMjBncmFkdWF0aW9uJTIwc3VjY2Vzc3xlbnwxfHx8fDE3NzYzNjEwODV8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    likes: 124,
    comments: 18,
    shares: 7,
  },
  {
    id: 2,
    author: {
      name: "Michael Chen",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=michael",
      headline: "Engineering Student @ Stanford",
    },
    timestamp: "5 hours ago",
    content: "Just submitted my final project for my robotics course! The past semester has been challenging but incredibly rewarding. Looking forward to applying for research positions this summer.",
    likes: 89,
    comments: 12,
    shares: 3,
  },
  {
    id: 3,
    author: {
      name: "Emily Rodriguez",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=emily",
      headline: "Medical Student @ Johns Hopkins",
    },
    timestamp: "1 day ago",
    content: "Honored to receive the Healthcare Leadership Scholarship! This support will enable me to focus on my studies and continue volunteering at the local clinic. Thank you to everyone who supported my application.",
    image: "https://images.unsplash.com/photo-1638636241638-aef5120c5153?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzY2hvbGFyc2hpcCUyMGF3YXJkJTIwY2VydGlmaWNhdGV8ZW58MXx8fHwxNzc2MzYxMDg1fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    likes: 256,
    comments: 34,
    shares: 15,
  },
  {
    id: 4,
    author: {
      name: "David Lee",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=david",
      headline: "Business Administration @ Harvard",
    },
    timestamp: "2 days ago",
    content: "Great networking event at the Business Leaders Summit! Made some amazing connections and learned a lot about entrepreneurship in the tech industry.",
    image: "https://images.unsplash.com/photo-1600096036367-a2bf5895620e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx1bml2ZXJzaXR5JTIwbGlicmFyeSUyMHN0dWR5aW5nJTIwYm9va3N8ZW58MXx8fHwxNzc2MzYxMDg2fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    likes: 67,
    comments: 8,
    shares: 2,
  },
];

export function Dashboard() {
  const [postContent, setPostContent] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const user = getStoredUser();

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Create Post */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Avatar>
              <AvatarImage
                src={resolvePublicAssetUrl(
                  pickProfileImageUrl(user as Record<string, unknown>) || user?.profileImage,
                )}
              />
              <AvatarFallback>{getInitials(user)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <Textarea
                placeholder="What's on your mind?"
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                className="min-h-[100px] resize-none"
              />
              <div className="flex items-center justify-between mt-3">
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="sm">
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Photo
                  </Button>
                  <Button type="button" variant="ghost" size="sm">
                    <FileText className="h-4 w-4 mr-2" />
                    Document
                  </Button>
                </div>
                <Button type="button" size="sm">Post</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feed Filters */}
      <div className="mb-6">
        <Tabs value={activeFilter} onValueChange={setActiveFilter}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="academic">Academic</TabsTrigger>
            <TabsTrigger value="achievements">Achievements</TabsTrigger>
            <TabsTrigger value="updates">Updates</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Posts Feed */}
      <div className="space-y-6">
        {mockPosts.map((post) => (
          <Card key={post.id}>
            <CardHeader>
              <div className="flex items-start gap-3">
                <Avatar>
                  <AvatarImage src={post.author.avatar} />
                  <AvatarFallback>{post.author.name[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{post.author.name}</p>
                      <p className="text-sm text-muted-foreground">{post.author.headline}</p>
                    </div>
                    <span className="text-sm text-muted-foreground">{post.timestamp}</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="mb-4 whitespace-pre-line">{post.content}</p>
              
              {post.image && (
                <div className="rounded-lg overflow-hidden mb-4">
                  <ImageWithFallback
                    src={post.image}
                    alt="Post content"
                    className="w-full h-auto"
                  />
                </div>
              )}

              <Separator className="mb-3" />

              <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
                <span>{post.likes} likes</span>
                <div className="flex gap-3">
                  <span>{post.comments} comments</span>
                  <span>{post.shares} shares</span>
                </div>
              </div>

              <Separator className="mb-3" />

              <div className="flex items-center justify-around">
                <Button type="button" variant="ghost" size="sm" className="flex-1">
                  <Heart className="h-4 w-4 mr-2" />
                  Like
                </Button>
                <Button type="button" variant="ghost" size="sm" className="flex-1">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Comment
                </Button>
                <Button type="button" variant="ghost" size="sm" className="flex-1">
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
                <Button type="button" variant="ghost" size="sm" className="flex-1">
                  <Bookmark className="h-4 w-4 mr-2" />
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
