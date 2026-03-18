import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import { loginSchema, createUserSchema, insertEventSchema, insertCommentSchema } from "@shared/schema";
import { z } from "zod";
import pgSession from "connect-pg-simple";
import { pool } from "./db";

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "No autorizado" });
  }
  next();
};

const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "No autorizado" });
  }
  const user = await storage.getUserById(req.session.userId);
  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "Acceso denegado" });
  }
  next();
};

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const PgStore = pgSession(session);
  
  app.use(
    session({
      store: new PgStore({
        pool: pool,
        tableName: "user_sessions",
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "fimaz-events-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    })
  );

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const data = loginSchema.parse(req.body);
      const user = await storage.getUserByEmail(data.email);
      
      if (!user) {
        return res.status(401).json({ error: "Credenciales inválidas" });
      }
      
      if (user.isBlocked) {
        return res.status(403).json({ error: "Usuario bloqueado" });
      }
      
      const validPassword = await bcrypt.compare(data.password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: "Credenciales inválidas" });
      }
      
      req.session.userId = user.id;
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      res.status(500).json({ error: "Error del servidor" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Error al cerrar sesión" });
      }
      res.json({ message: "Sesión cerrada" });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "No autorizado" });
    }
    const user = await storage.getUserById(req.session.userId);
    if (!user) {
      return res.status(401).json({ error: "Usuario no encontrado" });
    }
    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  });

  // Public events routes
  app.get("/api/events", async (req, res) => {
    try {
      const category = req.query.category as string | undefined;
      const timeFilter = req.query.time as string | undefined;
      const userId = req.session.userId;
      
      let includeAll = false;
      if (userId) {
        const user = await storage.getUserById(userId);
        if (user?.role === "admin") {
          includeAll = true;
        }
      }
      
      const events = await storage.getEvents(category, userId, timeFilter, includeAll);
      res.json(events);
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({ error: "Error al obtener eventos" });
    }
  });

  app.get("/api/events/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.session.userId;
      
      let includeArchived = false;
      if (userId) {
        const user = await storage.getUserById(userId);
        if (user?.role === "admin") {
          includeArchived = true;
        }
      }
      
      await storage.incrementEventViews(id);
      const event = await storage.getEventById(id, userId, includeArchived);
      if (!event) {
        return res.status(404).json({ error: "Evento no encontrado" });
      }
      res.json(event);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener evento" });
    }
  });

  app.post("/api/events/:id/like", requireAuth, async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const userId = req.session.userId!;
      const isLiked = await storage.toggleLike(eventId, userId);
      res.json({ isLiked });
    } catch (error) {
      res.status(500).json({ error: "Error al dar like" });
    }
  });

  app.post("/api/events/:id/attend", requireAuth, async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const userId = req.session.userId!;
      const isAttending = await storage.toggleAttendance(eventId, userId);
      res.json({ isAttending });
    } catch (error) {
      res.status(500).json({ error: "Error al confirmar asistencia" });
    }
  });

  app.get("/api/events/:id/comments", async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const comments = await storage.getCommentsByEventId(eventId);
      res.json(comments);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener comentarios" });
    }
  });

  app.post("/api/events/:id/comments", requireAuth, async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const userId = req.session.userId!;
      const { content } = req.body;
      
      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: "El comentario no puede estar vacío" });
      }
      
      const comment = await storage.createComment({ eventId, userId, content });
      res.json(comment);
    } catch (error) {
      res.status(500).json({ error: "Error al crear comentario" });
    }
  });

  // User routes
  app.get("/api/users/me/followers", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const followers = await storage.getFollowers(userId);
      res.json(followers);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener seguidores" });
    }
  });

  app.get("/api/users/me/following", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const following = await storage.getFollowing(userId);
      res.json(following);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener seguidos" });
    }
  });

  app.post("/api/users/:id/follow", requireAuth, async (req, res) => {
    try {
      const followingId = parseInt(req.params.id);
      const followerId = req.session.userId!;
      
      if (followerId === followingId) {
        return res.status(400).json({ error: "No puedes seguirte a ti mismo" });
      }
      
      const isFollowing = await storage.toggleFollow(followerId, followingId);
      res.json({ isFollowing });
    } catch (error) {
      res.status(500).json({ error: "Error al seguir usuario" });
    }
  });

  app.get("/api/users/me/liked-events", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const events = await storage.getLikedEvents(userId);
      res.json(events);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener eventos" });
    }
  });

  app.get("/api/users/me/attending-events", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const events = await storage.getAttendingEvents(userId);
      res.json(events);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener eventos" });
    }
  });

  app.patch("/api/users/me/profile", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { name } = req.body;
      
      if (!name || name.trim().length < 2) {
        return res.status(400).json({ error: "El nombre debe tener al menos 2 caracteres" });
      }
      
      const user = await storage.updateUserName(userId, name.trim());
      if (!user) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ error: "Error al actualizar perfil" });
    }
  });

  // Chat routes
  app.get("/api/chats", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const chats = await storage.getChats(userId);
      res.json(chats);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener chats" });
    }
  });

  app.post("/api/chats", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { otherUserId } = req.body;
      
      if (!otherUserId) {
        return res.status(400).json({ error: "ID de usuario requerido" });
      }
      
      const chat = await storage.createOrGetChat(userId, otherUserId);
      res.json(chat);
    } catch (error) {
      res.status(500).json({ error: "Error al crear chat" });
    }
  });

  app.get("/api/chats/:id/messages", requireAuth, async (req, res) => {
    try {
      const chatId = parseInt(req.params.id);
      const userId = req.session.userId!;
      
      const chat = await storage.getChatById(chatId, userId);
      if (!chat) {
        return res.status(404).json({ error: "Chat no encontrado" });
      }
      
      await storage.markMessagesAsRead(chatId, userId);
      const messages = await storage.getMessages(chatId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener mensajes" });
    }
  });

  app.post("/api/chats/:id/messages", requireAuth, async (req, res) => {
    try {
      const chatId = parseInt(req.params.id);
      const senderId = req.session.userId!;
      const { content } = req.body;
      
      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: "El mensaje no puede estar vacío" });
      }
      
      const chat = await storage.getChatById(chatId, senderId);
      if (!chat) {
        return res.status(404).json({ error: "Chat no encontrado" });
      }
      
      const message = await storage.createMessage({ chatId, senderId, content });
      res.json(message);
    } catch (error) {
      res.status(500).json({ error: "Error al enviar mensaje" });
    }
  });

  // Notification routes
  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const notifications = await storage.getNotifications(userId);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener notificaciones" });
    }
  });

  app.patch("/api/notifications/:id/read", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.markNotificationAsRead(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Error al marcar notificación" });
    }
  });

  app.post("/api/notifications/read-all", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      await storage.markAllNotificationsAsRead(userId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Error al marcar notificaciones" });
    }
  });

  // Admin routes
  app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    try {
      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener estadísticas" });
    }
  });

  app.get("/api/admin/events/:filter?", requireAdmin, async (req, res) => {
    try {
      const filter = req.params.filter || "all";
      let events = await storage.getEvents(undefined, undefined, undefined, true);
      
      if (filter === "active") {
        events = events.filter(e => !e.isArchived);
      } else if (filter === "archived") {
        events = events.filter(e => e.isArchived);
      }
      
      res.json(events);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener eventos" });
    }
  });

  app.post("/api/admin/events", requireAdmin, async (req, res) => {
    try {
      const eventData = insertEventSchema.parse({
        ...req.body,
        createdBy: req.session.userId,
        eventDate: new Date(req.body.eventDate),
      });
      const event = await storage.createEvent(eventData);
      res.json(event);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      res.status(500).json({ error: "Error al crear evento" });
    }
  });

  app.patch("/api/admin/events/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const eventData = { ...req.body };
      if (eventData.eventDate) {
        eventData.eventDate = new Date(eventData.eventDate);
      }
      const event = await storage.updateEvent(id, eventData);
      if (!event) {
        return res.status(404).json({ error: "Evento no encontrado" });
      }
      res.json(event);
    } catch (error) {
      res.status(500).json({ error: "Error al actualizar evento" });
    }
  });

  app.delete("/api/admin/events/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteEvent(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Error al eliminar evento" });
    }
  });

  app.patch("/api/admin/events/:id/archive", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const event = await storage.archiveEvent(id);
      if (!event) {
        return res.status(404).json({ error: "Evento no encontrado" });
      }
      res.json(event);
    } catch (error) {
      res.status(500).json({ error: "Error al archivar evento" });
    }
  });

  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users.map(({ password, ...u }) => u));
    } catch (error) {
      res.status(500).json({ error: "Error al obtener usuarios" });
    }
  });

  app.post("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const userData = createUserSchema.parse(req.body);
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ error: "El email ya está registrado" });
      }
      const user = await storage.createUser(userData);
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      res.status(500).json({ error: "Error al crear usuario" });
    }
  });

  app.patch("/api/admin/users/:id/block", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { isBlocked } = req.body;
      
      if (id === req.session.userId) {
        return res.status(400).json({ error: "No puedes bloquearte a ti mismo" });
      }
      
      const user = await storage.updateUserBlocked(id, isBlocked);
      if (!user) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ error: "Error al bloquear usuario" });
    }
  });

  app.patch("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name, role } = req.body;
      
      const updateData: { name?: string; role?: "admin" | "student" } = {};
      if (name && name.trim().length >= 2) {
        updateData.name = name.trim();
      }
      if (role && (role === "admin" || role === "student")) {
        updateData.role = role;
      }
      
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: "No hay datos para actualizar" });
      }
      
      const user = await storage.updateUserByAdmin(id, updateData);
      if (!user) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ error: "Error al actualizar usuario" });
    }
  });

  app.get("/api/admin/comments", requireAdmin, async (req, res) => {
    try {
      const comments = await storage.getAllComments();
      res.json(comments);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener comentarios" });
    }
  });

  app.delete("/api/comments/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteComment(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Error al eliminar comentario" });
    }
  });

  app.get("/api/admin/metrics", requireAdmin, async (req, res) => {
    try {
      const metrics = await storage.getMetrics();
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener métricas" });
    }
  });

  // Bootstrap first admin user
  app.post("/api/auth/bootstrap", async (req, res) => {
    try {
      const userCount = await storage.getUserCount();
      if (userCount > 0) {
        return res.status(400).json({ error: "Ya existe un administrador" });
      }
      
      const userData = createUserSchema.parse({ ...req.body, role: "admin" });
      const user = await storage.createUser(userData);
      const { password, ...userWithoutPassword } = user;
      req.session.userId = user.id;
      res.json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      res.status(500).json({ error: "Error al crear administrador" });
    }
  });

  app.get("/api/auth/needs-bootstrap", async (req, res) => {
    try {
      const userCount = await storage.getUserCount();
      res.json({ needsBootstrap: userCount === 0 });
    } catch (error) {
      res.status(500).json({ error: "Error del servidor" });
    }
  });

  return httpServer;
}
