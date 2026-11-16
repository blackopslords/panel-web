import { useEffect, useMemo, useState } from 'react';
import { HeroCarousel } from './components/HeroCarousel';
import { Navbar, NavSection } from './components/Navbar';
import { ProfileEditorModal } from './components/ProfileEditorModal';
import { ProfileSpotlight } from './components/ProfileSpotlight';
import { ServerFooterSection } from './components/ServerFooterSection';
import { TeamRosterSection } from './components/TeamRosterSection';
import { DEFAULT_TEAM_PROFILES, TeamProfile } from './data/teamProfiles';
import { profileAudio } from './utils/profileAudio';

const PROFILES_STORAGE_KEY = 'discord_panel_profiles_v1';
const STARRED_STORAGE_KEY = 'discord_panel_starred_v1';

export default function App() {
  const [profiles, setProfiles] = useState<TeamProfile[]>(() => {
    try {
      const saved = window.localStorage.getItem(PROFILES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Ignore storage read errors
    }
    return DEFAULT_TEAM_PROFILES;
  });

  const [activeIndex, setActiveIndex] = useState(0);
  const [activeFilter, setActiveFilter] = useState<NavSection>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingProfile, setEditingProfile] = useState<TeamProfile | null>(null);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const [starredIds, setStarredIds] = useState<string[]>(() => {
    try {
      const saved = window.localStorage.getItem(STARRED_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Ignore storage read errors
    }
    return ['kaisar-founder', 'rafi-commander'];
  });

  useEffect(() => {
    try {
      // Avoid persisting temporary blob URLs from uploaded audio files
      const serializable = profiles.map((p) => ({
        ...p,
        customAudioUrl: undefined,
      }));
      window.localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(serializable));
    } catch {
      // Ignore storage quota errors (e.g. very large uploaded screenshots)
    }
  }, [profiles]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STARRED_STORAGE_KEY, JSON.stringify(starredIds));
    } catch {
      // Ignore storage write errors
    }
  }, [starredIds]);

  useEffect(() => {
    return () => {
      profileAudio.stop();
    };
  }, []);

  const activeProfile = profiles[activeIndex] ?? profiles[0];

  // Switch audio whenever active profile changes while music is playing
  useEffect(() => {
    if (isMusicPlaying && activeProfile) {
      profileAudio.play(activeProfile.trackId, activeProfile.customAudioUrl);
    }
  }, [
    isMusicPlaying,
    activeProfile?.id,
    activeProfile?.trackId,
    activeProfile?.customAudioUrl,
  ]);

  const handleToggleMusic = () => {
    if (isMusicPlaying) {
      profileAudio.stop();
      setIsMusicPlaying(false);
    } else {
      profileAudio.play(activeProfile.trackId, activeProfile.customAudioUrl);
      setIsMusicPlaying(true);
    }
  };

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    profileAudio.setMuted(nextMuted);
  };

  const handleSelectProfile = (index: number, autoPlayMusic = false) => {
    setActiveIndex(index);
    if (autoPlayMusic) {
      const target = profiles[index];
      if (target) {
        setIsMusicPlaying(true);
        profileAudio.play(target.trackId, target.customAudioUrl);
      }
    }
  };

  const handleActivateById = (profileId: string, playMusic = false) => {
    const idx = profiles.findIndex((p) => p.id === profileId);
    if (idx !== -1) {
      handleSelectProfile(idx, playMusic);
    }
  };

  const handleToggleStar = (profileId: string) => {
    setStarredIds((prev) =>
      prev.includes(profileId)
        ? prev.filter((id) => id !== profileId)
        : [...prev, profileId]
    );
  };

  const handleSaveProfile = (updated: TeamProfile) => {
    setProfiles((prev) =>
      prev.map((p) => (p.id === updated.id ? updated : p))
    );
  };

  const handleSaveQuickText = (
    profileId: string,
    nextText: string,
    nextNote: string
  ) => {
    setProfiles((prev) =>
      prev.map((p) =>
        p.id === profileId
          ? { ...p, customText: nextText, panelNote: nextNote }
          : p
      )
    );
  };

  const handleResetProfile = (profileId: string) => {
    const original = DEFAULT_TEAM_PROFILES.find((p) => p.id === profileId);
    if (!original) return;
    setProfiles((prev) =>
      prev.map((p) => (p.id === profileId ? original : p))
    );
  };

  // Keyboard arrows to browse 3D mirror profiles
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (editingProfile) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }
      if (e.key === 'ArrowRight') {
        setActiveIndex((prev) => (prev + 1) % profiles.length);
      } else if (e.key === 'ArrowLeft') {
        setActiveIndex((prev) => (prev - 1 + profiles.length) % profiles.length);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editingProfile, profiles.length]);

  const filteredProfiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return profiles.filter((profile) => {
      const matchesFilter =
        activeFilter === 'home'
          ? true
          : activeFilter === 'starred'
            ? starredIds.includes(profile.id)
            : profile.division === activeFilter;

      if (!matchesFilter) return false;
      if (!q) return true;

      return (
        profile.name.toLowerCase().includes(q) ||
        profile.discordHandle.toLowerCase().includes(q) ||
        profile.roleTitle.toLowerCase().includes(q) ||
        profile.customText.toLowerCase().includes(q) ||
        profile.specialty.toLowerCase().includes(q)
      );
    });
  }, [profiles, activeFilter, searchQuery, starredIds]);

  return (
    <div className="min-h-screen bg-[#070709] text-neutral-100">
      <Navbar
        activeFilter={activeFilter}
        onSelectFilter={setActiveFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <main>
        <HeroCarousel
          profiles={profiles}
          activeIndex={activeIndex}
          onSelectProfile={handleSelectProfile}
          onOpenEditor={setEditingProfile}
          starredIds={starredIds}
          onToggleStar={handleToggleStar}
          isMusicPlaying={isMusicPlaying}
          onToggleMusic={handleToggleMusic}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
        />

        <TeamRosterSection
          profiles={filteredProfiles}
          allProfiles={profiles}
          activeFilter={activeFilter}
          onSelectFilter={setActiveFilter}
          searchQuery={searchQuery}
          onClearSearch={() => setSearchQuery('')}
          activeProfileId={activeProfile.id}
          onActivateProfile={handleActivateById}
          onOpenEditor={setEditingProfile}
          starredIds={starredIds}
          onToggleStar={handleToggleStar}
        />

        <ProfileSpotlight
          profile={activeProfile}
          isMusicPlaying={isMusicPlaying}
          onToggleMusic={handleToggleMusic}
          onSaveQuickText={handleSaveQuickText}
          onOpenEditor={setEditingProfile}
        />

        <ServerFooterSection onSelectFilter={setActiveFilter} />
      </main>

      <ProfileEditorModal
        profile={editingProfile}
        onClose={() => setEditingProfile(null)}
        onSaveProfile={handleSaveProfile}
        onResetProfile={handleResetProfile}
      />
    </div>
  );
}
