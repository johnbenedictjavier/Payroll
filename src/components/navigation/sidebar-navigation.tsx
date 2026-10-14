import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { NavigationGroup } from "./navigation-config";
import { isNavigationItemActive } from "./navigation-config";

type SidebarNavigationProps = {
  groups: NavigationGroup[];
  collapsed?: boolean;
  mobile?: boolean;
  onNavigate?: () => void;
};

export function SidebarNavigation({
  groups,
  collapsed = false,
  mobile = false,
  onNavigate,
}: SidebarNavigationProps) {
  const location = useLocation();

  return (
    <nav
      aria-label={mobile ? "Mobile navigation" : "Primary navigation"}
      className={cn(
        "scrollbar-subtle flex min-h-0 flex-1 flex-col overflow-y-auto p-3",
        collapsed ? "space-y-3" : "space-y-5",
      )}
    >
      {groups.map((group) => (
        <section
          key={group.id}
          aria-label={collapsed ? group.label : undefined}
          aria-labelledby={
            collapsed
              ? undefined
              : `${mobile ? "mobile" : "desktop"}-nav-group-${group.id}`
          }
        >
          {!collapsed && (
            <h2
              id={`${mobile ? "mobile" : "desktop"}-nav-group-${group.id}`}
              className="px-3 pb-1 text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground"
            >
              {group.label}
            </h2>
          )}
          <div
            className={cn(
              "space-y-1",
              !collapsed && "border-l border-border/80 pl-2",
            )}
          >
            {group.items.map((item) => {
              const ItemIcon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  end={item.end}
                  to={item.to}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                  aria-label={collapsed ? item.label : undefined}
                  className={({ isActive: linkIsActive }) =>
                    cn(
                      "group flex items-center rounded-lg text-sm font-semibold transition",
                      collapsed
                        ? "justify-center px-2 py-3"
                        : "gap-3 px-3 py-2.5",
                      linkIsActive ||
                        isNavigationItemActive(item, location.pathname)
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )
                  }
                >
                  <ItemIcon className="h-4 w-4 shrink-0 transition-transform group-hover:scale-105" />
                  <span className={cn("truncate", collapsed && "sr-only")}>
                    {item.label}
                  </span>
                </NavLink>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );
}
