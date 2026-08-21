import { useCallback, useEffect, useState } from "react";
import api from "../api/client";

export function useFriends() {
  const [friendships, setFriendships] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [friendsRes, lbRes] = await Promise.all([
        api.get("/friends"),
        api.get("/friends/leaderboard"),
      ]);
      setFriendships(friendsRes.data);
      setLeaderboard(lbRes.data);
    } catch (err) {
      setError(err?.response?.data?.detail || "No se pudo cargar.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const sendRequest = async (email) => {
    await api.post("/friends/request", { email });
    await refresh();
  };

  const acceptRequest = async (id) => {
    await api.put(`/friends/${id}/accept`);
    await refresh();
  };

  const rejectRequest = async (id) => {
    await api.put(`/friends/${id}/reject`);
    await refresh();
  };

  const removeFriend = async (id) => {
    await api.delete(`/friends/${id}`);
    await refresh();
  };

  const pending = friendships.filter(
    (f) => f.status === "pending" && !f.i_am_requester
  );
  const accepted = friendships.filter((f) => f.status === "accepted");
  const sent = friendships.filter(
    (f) => f.status === "pending" && f.i_am_requester
  );

  return {
    friendships, leaderboard, loading, error,
    pending, accepted, sent,
    sendRequest, acceptRequest, rejectRequest, removeFriend,
    refresh,
  };
}
