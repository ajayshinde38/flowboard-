import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { SOCKET_EVENTS, type NotificationDTO, type TaskDTO } from '@flowboard/shared';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

export function useSocketSync(workspaceId: string | null, currentUserId: string | null) {
  const qc = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const lastJoinedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentUserId) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      return;
    }

    const socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    const joinCurrentWorkspace = () => {
      if (workspaceId) {
        socket.emit(SOCKET_EVENTS.WORKSPACE_JOIN, workspaceId);
        lastJoinedRef.current = workspaceId;
      }
    };

    socket.on('connect', joinCurrentWorkspace);

    socket.on(SOCKET_EVENTS.TASK_CREATED, (payload: { task: TaskDTO; actorId: string }) => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      if (payload.actorId !== currentUserId) {
        toast.info(`New task ${payload.task.identifier}: ${payload.task.title}`);
      }
    });

    socket.on(SOCKET_EVENTS.TASK_UPDATED, (payload: { task: TaskDTO; actorId: string }) => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['task', payload.task.id] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
    });

    socket.on(SOCKET_EVENTS.TASK_MOVED, (payload: { task: TaskDTO; actorId: string }) => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['task', payload.task.id] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    });

    socket.on(SOCKET_EVENTS.TASK_DELETED, (payload: { taskId: string }) => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.removeQueries({ queryKey: ['task', payload.taskId] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    });

    socket.on(SOCKET_EVENTS.COMMENT_CREATED, (payload: { taskId: string }) => {
      qc.invalidateQueries({ queryKey: ['task', payload.taskId] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    });

    socket.on(SOCKET_EVENTS.PROJECT_UPDATED, () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['project'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
    });

    socket.on(SOCKET_EVENTS.ACTIVITY_CREATED, () => {
      qc.invalidateQueries({ queryKey: ['activity'] });
    });

    socket.on(SOCKET_EVENTS.NOTIFICATION_CREATED, (notification: NotificationDTO) => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['auth', 'me'] });
      toast(notification.title, {
        description: notification.message,
      });
    });

    return () => {
      if (lastJoinedRef.current) {
        socket.emit(SOCKET_EVENTS.WORKSPACE_LEAVE, lastJoinedRef.current);
      }
      socket.disconnect();
      socketRef.current = null;
    };
  }, [currentUserId, workspaceId, qc]);
}
