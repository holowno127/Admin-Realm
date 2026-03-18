import { db } from "./db";
import { eq, and, or, desc, count, sql, ne, arrayContains } from "drizzle-orm";
import bcrypt from "bcrypt";
import {
  users, events, comments, likes, attendances, followers, chats, messages, notifications,
  type User, type InsertUser, type Event, type InsertEvent,
  type Comment, type InsertComment, type Like, type Attendance,
  type Follower, type Chat, type InsertChat, type Message, type InsertMessage,
  type Notification, type InsertNotification,
  type EventWithStats, type CommentWithUser, type ChatWithUser, type UserWithStats,
  type CreateUserInput
} from "@shared/schema";

export interface IStorage {
  getUserById(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(userData: CreateUserInput): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUserBlocked(id: number, isBlocked: boolean): Promise<User | undefined>;
  updateUserName(id: number, name: string): Promise<User | undefined>;
  updateUserByAdmin(id: number, data: { name?: string; role?: "admin" | "student" }): Promise<User | undefined>;
  getUserCount(): Promise<number>;

  getEvents(category?: string, userId?: number, timeFilter?: string, includeAll?: boolean): Promise<EventWithStats[]>;
  getEventById(id: number, userId?: number, includeArchived?: boolean): Promise<EventWithStats | undefined>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: number, event: Partial<InsertEvent>): Promise<Event | undefined>;
  deleteEvent(id: number): Promise<boolean>;
  archiveEvent(id: number): Promise<Event | undefined>;
  incrementEventViews(id: number): Promise<void>;

  getCommentsByEventId(eventId: number): Promise<CommentWithUser[]>;
  createComment(comment: InsertComment): Promise<Comment>;
  deleteComment(id: number): Promise<boolean>;
  getAllComments(): Promise<(Comment & { user: Pick<User, "id" | "name">; event: Pick<Event, "id" | "title"> })[]>;

  toggleLike(eventId: number, userId: number): Promise<boolean>;
  isEventLiked(eventId: number, userId: number): Promise<boolean>;
  getLikedEvents(userId: number): Promise<EventWithStats[]>;

  toggleAttendance(eventId: number, userId: number): Promise<boolean>;
  isEventAttending(eventId: number, userId: number): Promise<boolean>;
  getAttendingEvents(userId: number): Promise<EventWithStats[]>;

  getFollowers(userId: number): Promise<UserWithStats[]>;
  getFollowing(userId: number): Promise<UserWithStats[]>;
  toggleFollow(followerId: number, followingId: number): Promise<boolean>;
  isFollowing(followerId: number, followingId: number): Promise<boolean>;

  getChats(userId: number): Promise<ChatWithUser[]>;
  getChatById(id: number, userId: number): Promise<Chat | undefined>;
  createOrGetChat(user1Id: number, user2Id: number): Promise<Chat>;
  getMessages(chatId: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  markMessagesAsRead(chatId: number, userId: number): Promise<void>;

  getNotifications(userId: number): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: number): Promise<void>;
  markAllNotificationsAsRead(userId: number): Promise<void>;

  getAdminStats(): Promise<{
    totalUsers: number;
    totalEvents: number;
    totalComments: number;
    activeEvents: number;
    totalLikes: number;
    totalViews: number;
    topEvents: Array<{
      id: number;
      title: string;
      likes: number;
      comments: number;
      attendees: number;
    }>;
  }>;
  getMetrics(): Promise<{
    events: {
      id: number;
      title: string;
      categories: string[];
      eventDate: string;
      views: number;
      likes: number;
      comments: number;
      attendees: number;
    }[];
    totals: {
      views: number;
      likes: number;
      comments: number;
      attendees: number;
    };
  }>;
}

export class DatabaseStorage implements IStorage {
  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return user;
  }

  async createUser(userData: CreateUserInput): Promise<User> {
    const userCount = await this.getUserCount();
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const role = userCount === 0 ? "admin" : userData.role;
    
    const [user] = await db.insert(users).values({
      name: userData.name,
      email: userData.email,
      password: hashedPassword,
      role: role,
    }).returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUserBlocked(id: number, isBlocked: boolean): Promise<User | undefined> {
    const [user] = await db.update(users).set({ isBlocked }).where(eq(users.id, id)).returning();
    return user;
  }

  async updateUserName(id: number, name: string): Promise<User | undefined> {
    const [user] = await db.update(users).set({ name }).where(eq(users.id, id)).returning();
    return user;
  }

  async updateUserByAdmin(id: number, data: { name?: string; role?: "admin" | "student" }): Promise<User | undefined> {
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return user;
  }

  async getUserCount(): Promise<number> {
    const [result] = await db.select({ count: count() }).from(users);
    return result.count;
  }

  async getEvents(category?: string, userId?: number, timeFilter?: string, includeAll?: boolean): Promise<EventWithStats[]> {
    const now = new Date();
    const conditions = [];

    if (category && category !== "all") {
      conditions.push(arrayContains(events.categories, [category as any]));
    }

    if (!includeAll) {
      conditions.push(eq(events.isArchived, false));
    }

    if (timeFilter === "past") {
      conditions.push(sql`${events.eventDate} < ${now}`);
    } else if (timeFilter === "upcoming") {
      conditions.push(sql`${events.eventDate} >= ${now}`);
    }

    const whereClause = conditions.length > 0 ? (conditions.length === 1 ? conditions[0] : and(...conditions)) : undefined;
    
    const baseEvents = await db.select().from(events)
      .where(whereClause)
      .orderBy(desc(events.eventDate));

    return Promise.all(baseEvents.map(async (event) => {
      const [likesResult] = await db.select({ count: count() }).from(likes).where(eq(likes.eventId, event.id));
      const [commentsResult] = await db.select({ count: count() }).from(comments).where(eq(comments.eventId, event.id));
      const [attendeesResult] = await db.select({ count: count() }).from(attendances).where(eq(attendances.eventId, event.id));
      
      let isLiked = false;
      let isAttending = false;
      if (userId) {
        isLiked = await this.isEventLiked(event.id, userId);
        isAttending = await this.isEventAttending(event.id, userId);
      }

      return {
        ...event,
        likesCount: likesResult.count,
        commentsCount: commentsResult.count,
        attendeesCount: attendeesResult.count,
        isLiked,
        isAttending,
      };
    }));
  }

  async getEventById(id: number, userId?: number, includeArchived?: boolean): Promise<EventWithStats | undefined> {
    const whereClause = includeArchived 
      ? eq(events.id, id)
      : and(eq(events.id, id), eq(events.isArchived, false));
    const [event] = await db.select().from(events).where(whereClause).limit(1);
    if (!event) return undefined;

    const [likesResult] = await db.select({ count: count() }).from(likes).where(eq(likes.eventId, id));
    const [commentsResult] = await db.select({ count: count() }).from(comments).where(eq(comments.eventId, id));
    const [attendeesResult] = await db.select({ count: count() }).from(attendances).where(eq(attendances.eventId, id));

    let isLiked = false;
    let isAttending = false;
    if (userId) {
      isLiked = await this.isEventLiked(id, userId);
      isAttending = await this.isEventAttending(id, userId);
    }

    return {
      ...event,
      likesCount: likesResult.count,
      commentsCount: commentsResult.count,
      attendeesCount: attendeesResult.count,
      isLiked,
      isAttending,
    };
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    const [newEvent] = await db.insert(events).values(event).returning();
    return newEvent;
  }

  async updateEvent(id: number, eventData: Partial<InsertEvent>): Promise<Event | undefined> {
    const [event] = await db.update(events).set(eventData).where(eq(events.id, id)).returning();
    return event;
  }

  async deleteEvent(id: number): Promise<boolean> {
    const result = await db.delete(events).where(eq(events.id, id));
    return true;
  }

  async archiveEvent(id: number): Promise<Event | undefined> {
    const [event] = await db.update(events).set({ isArchived: true }).where(eq(events.id, id)).returning();
    return event;
  }

  async incrementEventViews(id: number): Promise<void> {
    await db.update(events).set({ views: sql`${events.views} + 1` }).where(eq(events.id, id));
  }

  async getCommentsByEventId(eventId: number): Promise<CommentWithUser[]> {
    const result = await db.select({
      id: comments.id,
      eventId: comments.eventId,
      userId: comments.userId,
      content: comments.content,
      createdAt: comments.createdAt,
      user: {
        id: users.id,
        name: users.name,
      },
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.eventId, eventId))
    .orderBy(desc(comments.createdAt));

    return result;
  }

  async createComment(comment: InsertComment): Promise<Comment> {
    const [newComment] = await db.insert(comments).values(comment).returning();
    return newComment;
  }

  async deleteComment(id: number): Promise<boolean> {
    await db.delete(comments).where(eq(comments.id, id));
    return true;
  }

  async getAllComments(): Promise<(Comment & { user: Pick<User, "id" | "name">; event: Pick<Event, "id" | "title"> })[]> {
    const result = await db.select({
      id: comments.id,
      eventId: comments.eventId,
      userId: comments.userId,
      content: comments.content,
      createdAt: comments.createdAt,
      user: {
        id: users.id,
        name: users.name,
      },
      event: {
        id: events.id,
        title: events.title,
      },
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .innerJoin(events, eq(comments.eventId, events.id))
    .orderBy(desc(comments.createdAt));

    return result;
  }

  async toggleLike(eventId: number, userId: number): Promise<boolean> {
    const existing = await db.select().from(likes)
      .where(and(eq(likes.eventId, eventId), eq(likes.userId, userId)))
      .limit(1);

    if (existing.length > 0) {
      await db.delete(likes).where(and(eq(likes.eventId, eventId), eq(likes.userId, userId)));
      return false;
    } else {
      await db.insert(likes).values({ eventId, userId });
      return true;
    }
  }

  async isEventLiked(eventId: number, userId: number): Promise<boolean> {
    const [result] = await db.select().from(likes)
      .where(and(eq(likes.eventId, eventId), eq(likes.userId, userId)))
      .limit(1);
    return !!result;
  }

  async getLikedEvents(userId: number): Promise<EventWithStats[]> {
    const likedEventIds = await db.select({ eventId: likes.eventId }).from(likes).where(eq(likes.userId, userId));
    const eventsList: EventWithStats[] = [];
    for (const { eventId } of likedEventIds) {
      const event = await this.getEventById(eventId, userId);
      if (event) eventsList.push(event);
    }
    return eventsList;
  }

  async toggleAttendance(eventId: number, userId: number): Promise<boolean> {
    const existing = await db.select().from(attendances)
      .where(and(eq(attendances.eventId, eventId), eq(attendances.userId, userId)))
      .limit(1);

    if (existing.length > 0) {
      await db.delete(attendances).where(and(eq(attendances.eventId, eventId), eq(attendances.userId, userId)));
      return false;
    } else {
      await db.insert(attendances).values({ eventId, userId });
      return true;
    }
  }

  async isEventAttending(eventId: number, userId: number): Promise<boolean> {
    const [result] = await db.select().from(attendances)
      .where(and(eq(attendances.eventId, eventId), eq(attendances.userId, userId)))
      .limit(1);
    return !!result;
  }

  async getAttendingEvents(userId: number): Promise<EventWithStats[]> {
    const attendingEventIds = await db.select({ eventId: attendances.eventId }).from(attendances).where(eq(attendances.userId, userId));
    const eventsList: EventWithStats[] = [];
    for (const { eventId } of attendingEventIds) {
      const event = await this.getEventById(eventId, userId);
      if (event) eventsList.push(event);
    }
    return eventsList;
  }

  async getFollowers(userId: number): Promise<UserWithStats[]> {
    const followersList = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isBlocked: users.isBlocked,
      createdAt: users.createdAt,
    })
    .from(followers)
    .innerJoin(users, eq(followers.followerId, users.id))
    .where(eq(followers.followingId, userId));

    return Promise.all(followersList.map(async (user) => {
      const [followersCount] = await db.select({ count: count() }).from(followers).where(eq(followers.followingId, user.id));
      const [followingCount] = await db.select({ count: count() }).from(followers).where(eq(followers.followerId, user.id));
      return {
        ...user,
        followersCount: followersCount.count,
        followingCount: followingCount.count,
      };
    }));
  }

  async getFollowing(userId: number): Promise<UserWithStats[]> {
    const followingList = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isBlocked: users.isBlocked,
      createdAt: users.createdAt,
    })
    .from(followers)
    .innerJoin(users, eq(followers.followingId, users.id))
    .where(eq(followers.followerId, userId));

    return Promise.all(followingList.map(async (user) => {
      const [followersCount] = await db.select({ count: count() }).from(followers).where(eq(followers.followingId, user.id));
      const [followingCount] = await db.select({ count: count() }).from(followers).where(eq(followers.followerId, user.id));
      return {
        ...user,
        followersCount: followersCount.count,
        followingCount: followingCount.count,
      };
    }));
  }

  async toggleFollow(followerId: number, followingId: number): Promise<boolean> {
    const existing = await db.select().from(followers)
      .where(and(eq(followers.followerId, followerId), eq(followers.followingId, followingId)))
      .limit(1);

    if (existing.length > 0) {
      await db.delete(followers).where(and(eq(followers.followerId, followerId), eq(followers.followingId, followingId)));
      return false;
    } else {
      await db.insert(followers).values({ followerId, followingId });
      return true;
    }
  }

  async isFollowing(followerId: number, followingId: number): Promise<boolean> {
    const [result] = await db.select().from(followers)
      .where(and(eq(followers.followerId, followerId), eq(followers.followingId, followingId)))
      .limit(1);
    return !!result;
  }

  async getChats(userId: number): Promise<ChatWithUser[]> {
    const chatsList = await db.select().from(chats)
      .where(or(eq(chats.user1Id, userId), eq(chats.user2Id, userId)))
      .orderBy(desc(chats.lastMessageAt));

    return Promise.all(chatsList.map(async (chat) => {
      const otherUserId = chat.user1Id === userId ? chat.user2Id : chat.user1Id;
      const [otherUser] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, otherUserId));
      
      const [lastMessage] = await db.select().from(messages)
        .where(eq(messages.chatId, chat.id))
        .orderBy(desc(messages.createdAt))
        .limit(1);

      const [unreadResult] = await db.select({ count: count() }).from(messages)
        .where(and(
          eq(messages.chatId, chat.id),
          ne(messages.senderId, userId),
          eq(messages.isRead, false)
        ));

      return {
        ...chat,
        otherUser,
        lastMessage,
        unreadCount: unreadResult.count,
      };
    }));
  }

  async getChatById(id: number, userId: number): Promise<Chat | undefined> {
    const [chat] = await db.select().from(chats)
      .where(and(
        eq(chats.id, id),
        or(eq(chats.user1Id, userId), eq(chats.user2Id, userId))
      ))
      .limit(1);
    return chat;
  }

  async createOrGetChat(user1Id: number, user2Id: number): Promise<Chat> {
    const [existing] = await db.select().from(chats)
      .where(or(
        and(eq(chats.user1Id, user1Id), eq(chats.user2Id, user2Id)),
        and(eq(chats.user1Id, user2Id), eq(chats.user2Id, user1Id))
      ))
      .limit(1);

    if (existing) return existing;

    const [newChat] = await db.insert(chats).values({ user1Id, user2Id }).returning();
    return newChat;
  }

  async getMessages(chatId: number): Promise<Message[]> {
    return db.select().from(messages)
      .where(eq(messages.chatId, chatId))
      .orderBy(messages.createdAt);
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [newMessage] = await db.insert(messages).values(message).returning();
    await db.update(chats).set({ lastMessageAt: new Date() }).where(eq(chats.id, message.chatId));
    return newMessage;
  }

  async markMessagesAsRead(chatId: number, userId: number): Promise<void> {
    await db.update(messages)
      .set({ isRead: true })
      .where(and(
        eq(messages.chatId, chatId),
        ne(messages.senderId, userId)
      ));
  }

  async getNotifications(userId: number): Promise<Notification[]> {
    return db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [newNotification] = await db.insert(notifications).values(notification).returning();
    return newNotification;
  }

  async markNotificationAsRead(id: number): Promise<void> {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
  }

  async markAllNotificationsAsRead(userId: number): Promise<void> {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
  }

  async getAdminStats(): Promise<{
    totalUsers: number;
    totalEvents: number;
    totalComments: number;
    activeEvents: number;
    totalLikes: number;
    totalViews: number;
    topEvents: Array<{
      id: number;
      title: string;
      likes: number;
      comments: number;
      attendees: number;
    }>;
  }> {
    const [usersResult] = await db.select({ count: count() }).from(users);
    const [eventsResult] = await db.select({ count: count() }).from(events);
    const [commentsResult] = await db.select({ count: count() }).from(comments);
    const [likesResult] = await db.select({ count: count() }).from(likes);
    const [viewsResult] = await db.select({ total: sql<number>`COALESCE(SUM(${events.views}), 0)` }).from(events);
    const [activeEventsResult] = await db.select({ count: count() }).from(events).where(eq(events.isArchived, false));

    const allEvents = await db.select().from(events);
    const eventsWithStats = await Promise.all(allEvents.map(async (event) => {
      const [likesRes] = await db.select({ count: count() }).from(likes).where(eq(likes.eventId, event.id));
      const [commentsRes] = await db.select({ count: count() }).from(comments).where(eq(comments.eventId, event.id));
      const [attendeesRes] = await db.select({ count: count() }).from(attendances).where(eq(attendances.eventId, event.id));
      
      return {
        id: event.id,
        title: event.title,
        likes: likesRes.count,
        comments: commentsRes.count,
        attendees: attendeesRes.count,
        totalInteractions: likesRes.count + commentsRes.count + attendeesRes.count
      };
    }));

    // Sort by total interactions and take top 5
    const topEvents = eventsWithStats
      .sort((a, b) => b.totalInteractions - a.totalInteractions)
      .slice(0, 5)
      .map(({ totalInteractions, ...rest }) => rest);

    return {
      totalUsers: usersResult.count,
      totalEvents: eventsResult.count,
      totalComments: commentsResult.count,
      activeEvents: activeEventsResult.count,
      totalLikes: likesResult.count,
      totalViews: Number(viewsResult.total) || 0,
      topEvents,
    };
  }

  async getMetrics(): Promise<{
    events: {
      id: number;
      title: string;
      categories: string[];
      eventDate: string;
      views: number;
      likes: number;
      comments: number;
      attendees: number;
    }[];
    totals: {
      views: number;
      likes: number;
      comments: number;
      attendees: number;
    };
  }> {
    const allEvents = await db.select().from(events).orderBy(desc(events.eventDate));
    
    let totalViews = 0;
    let totalLikes = 0;
    let totalComments = 0;
    let totalAttendees = 0;

    const eventsWithMetrics = await Promise.all(allEvents.map(async (event) => {
      const [likesResult] = await db.select({ count: count() }).from(likes).where(eq(likes.eventId, event.id));
      const [commentsResult] = await db.select({ count: count() }).from(comments).where(eq(comments.eventId, event.id));
      const [attendeesResult] = await db.select({ count: count() }).from(attendances).where(eq(attendances.eventId, event.id));

      const eventViews = event.views || 0;
      const eventLikes = likesResult.count;
      const eventComments = commentsResult.count;
      const eventAttendees = attendeesResult.count;

      totalViews += eventViews;
      totalLikes += eventLikes;
      totalComments += eventComments;
      totalAttendees += eventAttendees;

      return {
        id: event.id,
        title: event.title,
        categories: event.categories,
        eventDate: event.eventDate.toISOString(),
        views: eventViews,
        likes: eventLikes,
        comments: eventComments,
        attendees: eventAttendees,
      };
    }));

    return {
      events: eventsWithMetrics,
      totals: {
        views: totalViews,
        likes: totalLikes,
        comments: totalComments,
        attendees: totalAttendees,
      }
    };
  }
}

export const storage = new DatabaseStorage();
