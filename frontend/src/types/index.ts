export interface Organization {
  id: number;
  name: string;
  slug: string;
  plan: string;
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  avatar_url?: string;
}

export interface OrgMember {
  user_id: number;
  email: string;
  full_name: string;
  avatar_url?: string;
  role: string;
}

export interface Channel {
  id: number;
  org_id: number;
  type: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: number;
  org_id: number;
  external_id: string;
  channel_type: string;
  name: string;
  email: string;
  phone: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: number;
  org_id: number;
  channel_id: number | null;
  contact_id: number | null;
  assigned_to: number | null;
  status: "open" | "pending" | "resolved" | "closed";
  priority: "low" | "normal" | "high" | "urgent";
  subject: string;
  last_message_at: string | null;
  first_response_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  contact?: Contact;
  assigned_user?: User;
  channel_type?: string;
  last_message?: string;
  tags?: Tag[];
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_type: "contact" | "agent" | "bot" | "system";
  sender_id: number | null;
  content: string;
  content_type: "text" | "image" | "file" | "note";
  is_internal: boolean;
  external_id: string;
  created_at: string;
  sender_name?: string;
  attachments?: Attachment[];
}

export interface Attachment {
  id: number;
  message_id: number;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
}

export interface Tag {
  id: number;
  org_id: number;
  name: string;
  color: string;
}

export interface CannedResponse {
  id: number;
  org_id: number;
  shortcut: string;
  title: string;
  content: string;
}

export interface BotRule {
  id: number;
  org_id: number;
  name: string;
  keywords: string[];
  match_type: "contains" | "exact" | "regex";
  response_template: string;
  is_active: boolean;
  priority: number;
  channel_types: string[];
  created_at: string;
  updated_at: string;
}

export interface BotLog {
  id: number;
  org_id: number;
  rule_id: number | null;
  conversation_id: number | null;
  matched_keyword: string;
  action: string;
  created_at: string;
  rule_name?: string;
}

export interface ReportOverview {
  total_conversations: number;
  open_conversations: number;
  avg_response_time_minutes: number;
  avg_resolution_time_minutes: number;
  resolved_count: number;
  daily_volume: { date: string; count: number }[];
}

export interface AgentReport {
  user_id: number;
  full_name: string;
  conversation_count: number;
  avg_response_time_minutes: number;
  resolved_count: number;
  resolution_rate: number;
}

export interface ChannelReport {
  channel_type: string;
  count: number;
}
