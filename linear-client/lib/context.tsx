import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { api, authAPI, setToken, getToken } from "./api";

export interface User {
  _id: string;
  name: string;
  displayName?: string;
  email: string;
  avatar?: string;
  role?: string;
  teams?: any[];
  preferences?: {
    theme?: "light" | "dark";
    notifications?: boolean;
    emailNotifications?: boolean;
  };
}

interface Team {
  _id: string;
  name: string;
  identifier: string;
}

interface AppContextType {
  user: User | null;
  currentTeam: Team | null;
  teams: Team[];
  setCurrentTeam: (team: Team) => void;
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
  authLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: { email: string; password: string; name?: string; workspaceName?: string; teamIdentifier?: string }) => Promise<void>;
  logout: () => void;
  refreshTeams: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const DEMO_EMAIL = "demo@linear.app";
const DEMO_PASSWORD = "demo1234";

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [authLoading, setAuthLoading] = useState(true);

  const loadTeams = useCallback(async (u: User | null) => {
    try {
      const res = await api.get("/team");
      const teamsData = res.data || [];
      setTeams(teamsData);
      if (teamsData.length > 0) {
        const myTeams = u?.teams?.length
          ? teamsData.filter((t: Team) => (u!.teams as any[]).some((x: any) => (x._id || x) === t._id))
          : teamsData;
        setCurrentTeam((myTeams.length ? myTeams : teamsData)[0]);
      } else {
        setCurrentTeam(null);
      }
    } catch {
      setTeams([]);
      setCurrentTeam(null);
    }
  }, []);

  const bootstrapDemo = useCallback(async () => {
    // Try logging in as demo user; if missing, sign up (bootstraps workspace+team)
    try {
      const res = await authAPI.login({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
      setToken(res.data.token);
      setUser(res.data.user);
      await loadTeams(res.data.user);
    } catch {
      try {
        const res = await authAPI.signup({
          email: DEMO_EMAIL,
          password: DEMO_PASSWORD,
          name: "Demo User",
          workspaceName: "Linear Demo",
          teamName: "Engineering",
          teamIdentifier: "ENG",
        });
        setToken(res.data.token);
        setUser(res.data.user);
        await loadTeams(res.data.user);
      } catch (e) {
        console.error("Demo bootstrap failed", e);
      }
    }
  }, [loadTeams]);

  useEffect(() => {
    (async () => {
      const token = getToken();
      if (token) {
        try {
          const res = await authAPI.me();
          setUser(res.data.user);
          await loadTeams(res.data.user);
          setAuthLoading(false);
          return;
        } catch {
          setToken(null);
        }
      }
      // No session — auto-provision a demo account so the app is turnkey
      await bootstrapDemo();
      setAuthLoading(false);
    })();
  }, [bootstrapDemo, loadTeams]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", theme);
    }
  }, [theme]);

  const login = async (email: string, password: string) => {
    const res = await authAPI.login({ email, password });
    setToken(res.data.token);
    setUser(res.data.user);
    await loadTeams(res.data.user);
  };

  const signup = async (data: { email: string; password: string; name?: string; workspaceName?: string; teamIdentifier?: string }) => {
    const res = await authAPI.signup(data);
    setToken(res.data.token);
    setUser(res.data.user);
    await loadTeams(res.data.user);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setTeams([]);
    setCurrentTeam(null);
  };

  return (
    <AppContext.Provider
      value={{
        user,
        currentTeam,
        teams,
        setCurrentTeam,
        theme,
        setTheme,
        authLoading,
        login,
        signup,
        logout,
        refreshTeams: () => loadTeams(user),
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
}
