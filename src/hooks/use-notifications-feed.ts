"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export type NotificationItem = {
  _id: string;
  title: string;
  message: string;
  readAt: string | null;
  type?: string;
  createdAt?: string;
};

export const notificationsFeedQueryKey = ["notifications", "feed"] as const;

export function useNotificationsFeed() {
  return useQuery({
    queryKey: notificationsFeedQueryKey,
    queryFn: async () => {
      const { data } = await apiClient.get<{
        data: { items: NotificationItem[] };
      }>("/notifications?limit=100&sortOrder=desc");
      return data.data.items;
    },
    refetchInterval: 45_000,
    staleTime: 10_000,
    refetchOnWindowFocus: true
  });
}
