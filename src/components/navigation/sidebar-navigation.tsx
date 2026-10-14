import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { NavigationGroup } from "./navigation-config";
import { isNavigationItemActive } from "./navigation-config";

type SidebarNavigationProps = {
  groups: NavigationGroup[];
  collapsed?: boolean;
  mobile?: boolean;
  onNavigate?: () => void;
  onRequestExpand?: (groupId: string) => void;
};

export function SidebarNavigation({
  groups,
  collapsed = false,
  mobile = false,
  onNavigate,
  onRequestExpand,
}: SidebarNavigationProps) {
  const location = useLocation();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map((group) => [group.id, true])),
  );

  useEffect(() => {
    setOpenGroups((current) => {
      const next = { ...current };
      groups.forEach((group) => {
        if (!(group.id in next)) next[group.id] = true;
      });
      return next;
    });
  }, [groups]);

  useEffect(() => {
    const activeGroup = groups.find((group) =>
      group.items.some((item) =>
        isNavigationItemActive(item, location.pathname),
      ),
    );
    if (!activeGroup) return;
    setOpenGroups((current) =>
      current[activeGroup.id]
        ? current
        : { ...current, [activeGroup.id]: true },
    );
  }, [groups, location.pathname]);

  function toggleGroup(groupId: string) {
    if (collapsed) {
      setOpenGroups((current) => ({ ...current, [groupId]: true }));
      onRequestExpand?.(groupId);
      return;
    }
    setOpenGroups((current) => ({
      ...current,
      [groupId]: !current[groupId],
    }));
  }

  return (
    <nav
      aria-label={mobile ? "Mobile navigation" : "Primary navigation"}
      className={cn(
        "scrollbar-subtle flex min-h-0 flex-1 flex-col overflow-y-auto p-3",
        mobile ? "space-y-2" : "space-y-1",
      )}
    >
      {groups.map((group) => {
        const GroupIcon = group.icon;
        const isActive = group.items.some((item) =>
          isNavigationItemActive(item, location.pathname),
        );
        const isOpen = Boolean(openGroups[group.id]);
        const groupContentId = `${mobile ? "mobile" : "desktop"}-nav-group-${group.id}`;

        return (
          <div key={group.id} className="min-w-0">
            <button
              type="button"
              aria-controls={groupContentId}
              aria-expanded={!collapsed && isOpen}
              aria-label={collapsed ? group.label : undefined}
              title={collapsed ? group.label : undefined}
              onClick={() => toggleGroup(group.id)}
              className={cn(
                "group flex w-full items-center rounded-lg text-left text-[10px] font-bold uppercase tracking-[0.16em] transition",
                collapsed
                  ? "justify-center px-2 py-3"
                  : "gap-3 px-3 py-2.5",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <GroupIcon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="min-w-0 flex-1 truncate">{group.label}</span>}
              {!collapsed && (
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 transition-transform",
                    isOpen && "rotate-180",
                  )}
                />
              )}
            </button>
            <div
              id={groupContentId}
              hidden={collapsed || !isOpen}
              className="mt-1 space-y-1 border-l border-border/80 pl-2"
            >
              {group.items.map((item) => {
                const ItemIcon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    end={item.end}
                    to={item.to}
                    onClick={onNavigate}
                    className={({ isActive: linkIsActive }) =>
                      cn(
                        "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition",
                        linkIsActive ||
                          isNavigationItemActive(item, location.pathname)
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                      )
                    }
                  >
                    <ItemIcon className="h-4 w-4 shrink-0 transition-transform group-hover:scale-105" />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
