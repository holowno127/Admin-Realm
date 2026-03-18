import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const roleEnum = pgEnum("role", ["admin", "student"]);
export const categoryEnum = pgEnum("category", ["academico", "cultural", "deportivo"]);
export const notificationTypeEnum = pgEnum("notification_type", ["event_update", "new_comment", "new_follower", "new_message"]);

export const userSessions = pgTable("user_sessions", {
  sid: varchar("sid", { length: 255 }).primaryKey(),
  sess: text("sess").notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull(),
});

export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: roleEnum("role").notNull().default("student"),
  isBlocked: boolean("is_blocked").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  comments: many(comments),
  likes: many(likes),
  attendances: many(attendances),
  followers: many(followers, { relationName: "followers" }),
  following: many(followers, { relationName: "following" }),
  notifications: many(notifications),
  sentMessages: many(messages, { relationName: "sender" }),
  receivedMessages: many(messages, { relationName: "receiver" }),
}));

export const events = pgTable("events", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  categories: text("categories").array().notNull().default(sql`'{}'`),
  eventDate: timestamp("event_date").notNull(),
  location: text("location").notNull(),
  imageUrl: text("image_url"),
  isArchived: boolean("is_archived").notNull().default(false),
  views: integer("views").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: integer("created_by").references(() => users.id),
});

export const eventsRelations = relations(events, ({ many, one }) => ({
  comments: many(comments),
  likes: many(likes),
  attendances: many(attendances),
  creator: one(users, {
    fields: [events.createdBy],
    references: [users.id],
  }),
}));

export const comments = pgTable("comments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  eventId: integer("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const commentsRelations = relations(comments, ({ one }) => ({
  event: one(events, {
    fields: [comments.eventId],
    references: [events.id],
  }),
  user: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
}));

export const likes = pgTable("likes", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  eventId: integer("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const likesRelations = relations(likes, ({ one }) => ({
  event: one(events, {
    fields: [likes.eventId],
    references: [events.id],
  }),
  user: one(users, {
    fields: [likes.userId],
    references: [users.id],
  }),
}));

export const attendances = pgTable("attendances", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  eventId: integer("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const attendancesRelations = relations(attendances, ({ one }) => ({
  event: one(events, {
    fields: [attendances.eventId],
    references: [events.id],
  }),
  user: one(users, {
    fields: [attendances.userId],
    references: [users.id],
  }),
}));

export const followers = pgTable("followers", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  followerId: integer("follower_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  followingId: integer("following_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const followersRelations = relations(followers, ({ one }) => ({
  follower: one(users, {
    fields: [followers.followerId],
    references: [users.id],
    relationName: "following",
  }),
  following: one(users, {
    fields: [followers.followingId],
    references: [users.id],
    relationName: "followers",
  }),
}));

export const chats = pgTable("chats", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  user1Id: integer("user1_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  user2Id: integer("user2_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastMessageAt: timestamp("last_message_at").defaultNow().notNull(),
});

export const chatsRelations = relations(chats, ({ one, many }) => ({
  user1: one(users, {
    fields: [chats.user1Id],
    references: [users.id],
  }),
  user2: one(users, {
    fields: [chats.user2Id],
    references: [users.id],
  }),
  messages: many(messages),
}));

export const messages = pgTable("messages", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  chatId: integer("chat_id").notNull().references(() => chats.id, { onDelete: "cascade" }),
  senderId: integer("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isRead: boolean("is_read").notNull().default(false),
});

export const messagesRelations = relations(messages, ({ one }) => ({
  chat: one(chats, {
    fields: [messages.chatId],
    references: [chats.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
    relationName: "sender",
  }),
}));

export const notifications = pgTable("notifications", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: notificationTypeEnum("type").notNull(),
  referenceId: integer("reference_id"),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users) as unknown as z.ZodType<InsertUser>;

export const insertEventSchema = createInsertSchema(events) as unknown as z.ZodType<InsertEvent>;

export const insertCommentSchema = createInsertSchema(comments) as unknown as z.ZodType<InsertComment>;

export const insertLikeSchema = createInsertSchema(likes) as unknown as z.ZodType<InsertLike>;

export const insertAttendanceSchema = createInsertSchema(attendances) as unknown as z.ZodType<InsertAttendance>;

export const insertFollowerSchema = createInsertSchema(followers) as unknown as z.ZodType<InsertFollower>;

export const insertChatSchema = createInsertSchema(chats) as unknown as z.ZodType<InsertChat>;

export const insertMessageSchema = createInsertSchema(messages) as unknown as z.ZodType<InsertMessage>;

export const insertNotificationSchema = createInsertSchema(notifications) as unknown as z.ZodType<InsertNotification>;

// Login schema
export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

// Create user schema for admin
export const createUserSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  role: z.enum(["admin", "student"]),
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Event = typeof events.$inferSelect;
export type InsertEvent = typeof events.$inferInsert;
export type Comment = typeof comments.$inferSelect;
export type InsertComment = typeof comments.$inferInsert;
export type Like = typeof likes.$inferSelect;
export type InsertLike = typeof likes.$inferInsert;
export type Attendance = typeof attendances.$inferSelect;
export type InsertAttendance = typeof attendances.$inferInsert;
export type Follower = typeof followers.$inferSelect;
export type InsertFollower = typeof followers.$inferInsert;
export type Chat = typeof chats.$inferSelect;
export type InsertChat = typeof chats.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;

// Extended types with relations
export type EventWithStats = Event & {
  likesCount: number;
  commentsCount: number;
  attendeesCount: number;
  isLiked?: boolean;
  isAttending?: boolean;
};

export type CommentWithUser = Comment & {
  user: Pick<User, "id" | "name">;
};

export type ChatWithUser = Chat & {
  otherUser: Pick<User, "id" | "name">;
  lastMessage?: Message;
  unreadCount: number;
};

export type UserWithStats = Omit<User, "password"> & {
  followersCount: number;
  followingCount: number;
  isFollowing?: boolean;
};
