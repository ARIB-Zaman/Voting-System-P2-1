import { UserAvatar } from "@/components/refine-ui/layout/user-avatar";
import { ThemeToggle } from "@/components/refine-ui/theme/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import {
  useActiveAuthProvider,
  useGetIdentity,
  useLogout,
  useLink,
} from "@refinedev/core";
import { LogOutIcon, Origami, BrainCircuit, BriefcaseMedical, Smile } from "lucide-react";
import { useAttentionOverlayContext, AttentionRecoveredBadge } from "@/components/custom/attention-overlay";

interface Identity {
  role?: string;
  name?: string;
  email?: string;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin Hub",
  USER: "Welec",
};

export const Header = () => {
  const { isMobile } = useSidebar();

  return <>{isMobile ? <MobileHeader /> : <DesktopHeader />}</>;
};

function DesktopHeader() {
  const { overlayState, isRecovered, triggerAttention } = useAttentionOverlayContext();
  const isActive = overlayState === 'visible';

  return (
    <header
      className={cn(
        "sticky",
        "top-0",
        "flex",
        "h-16",
        "shrink-0",
        "items-center",
        "gap-4",
        "border-b",
        "border-border",
        "bg-sidebar",
        "pr-3",
        "justify-end",
        "z-40"
      )}
    >
      {/* Attention Recovered toast badge */}
      <AttentionRecoveredBadge visible={isRecovered} />

      {/* "I'm Losing Attention" button */}
      <button
        id="ao-trigger-button"
        className={cn('ao-trigger-btn', { 'ao-trigger-btn--active': isActive })}
        onClick={triggerAttention}
        aria-pressed={isActive}
        aria-label={isActive ? 'Close attention overlay' : "I'm losing attention — bring it back"}
        title={isActive ? 'I\'m Happy' : "I'm Losing Attention"}
      >
        {isActive ? <Smile size={20} /> : <BriefcaseMedical size={20} />}
        <span>{isActive ? 'I\'m Happy' : "I'm Losing Attention"}</span>
      </button>

      <ThemeToggle />
      <UserDropdown />
    </header>
  );
}

function MobileHeader() {
  const { open, isMobile } = useSidebar();
  const { data: identity } = useGetIdentity<Identity>();
  const roleLabel = identity?.role ? (ROLE_LABELS[identity.role] ?? 'Welec') : 'Welec';

  const title = { icon: <Origami />, text: roleLabel }

  const Link = useLink();
  return (
    <header
      className={cn(
        "sticky",
        "top-0",
        "flex",
        "h-12",
        "shrink-0",
        "items-center",
        "gap-2",
        "border-b",
        "border-border",
        "bg-sidebar",
        "pr-3",
        "justify-between",
        "z-40"
      )}
    >
      <SidebarTrigger
        className={cn("text-muted-foreground", "rotate-180", "ml-1", {
          "opacity-0": open,
          "opacity-100": !open || isMobile,
          "pointer-events-auto": !open || isMobile,
          "pointer-events-none": open && !isMobile,
        })}
      />

      <Link
        to={identity?.role === 'USER' ? '/homeUSER' : '/homeAdmin'}
        className={cn(
          "whitespace-nowrap",
          "flex",
          "flex-row",
          "h-full",
          "items-center",
          "justify-start",
          "gap-2",
          "transition-all",
          "duration-200",
          "hover:opacity-80",
          {
            "pl-3": !open,
            "pl-5": open,
          }
        )}
      >
        <div className="text-primary">{title.icon}</div>
        <h2
          className={cn(
            "text-sm",
            "font-bold",
            "transition-opacity",
            "duration-200",
            {
              "opacity-0": !open,
              "opacity-100": open,
            }
          )}
        >
          {title.text}
        </h2>
      </Link>

      <ThemeToggle className={cn("h-8", "w-8")} />
    </header>
  );
}

const UserDropdown = () => {
  const { data: identity } = useGetIdentity<Identity>();
  const { mutate: logout, isPending: isLoggingOut } = useLogout();

  const authProvider = useActiveAuthProvider();

  if (!authProvider?.getIdentity) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <UserAvatar />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {identity?.name && (
          <>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{identity.name}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {identity.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem
          onClick={() => {
            logout();
          }}
        >
          <LogOutIcon
            className={cn("text-destructive", "hover:text-destructive")}
          />
          <span className={cn("text-destructive", "hover:text-destructive")}>
            {isLoggingOut ? "Logging out..." : "Logout"}
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

Header.displayName = "Header";
MobileHeader.displayName = "MobileHeader";
DesktopHeader.displayName = "DesktopHeader";
