/* ============================================================
   Nradiowave R/W — árbol genealógico y wiki de personajes
   Sin dependencias. Los datos se guardan en localStorage.
   ============================================================ */

(() => {
  "use strict";

  /* ---------------- Constantes ---------------- */
  const WORLD_W = 6000;
  const WORLD_H = 4000;
  const NODE_W = 184;
  const NODE_H = 234;
  const STORAGE_KEY = "nradiowave.wiki.v1";
  const THEME_KEY = "nradiowave.theme.v1";
  const PANEL_KEY = "nradiowave.panels.v1";
  const LAYOUT_KEY = "nradiowave.layout.v2";

  /* Sincronización compartida con Firebase Realtime Database.
     Pega aquí la URL de tu base de datos, por ejemplo:
     const SYNC_URL = "https://mi-proyecto-default-rtdb.firebaseio.com";
     Con la URL vacía la app funciona solo con el almacenamiento local. */
  const SYNC_URL = "https://nradiowave-rw-default-rtdb.firebaseio.com";
  const SYNC_PATH = "nradiowave";
  const PENDING_KEY = "nradiowave.pending.v1";

  const LEGACY_KEYS = {
    wiki: "nexo.wiki.v1",
    theme: "nexo.theme.v1",
    panels: "nexo.panels.v1",
    layout: "nexo.layout.v2",
  };
  const MIN_ZOOM = 0.18;
  const MAX_ZOOM = 2.3;
  const SVG_NS = "http://www.w3.org/2000/svg";

  const REL_TYPES = [
    {
      id: "pareja",
      label: "Pareja",
      short: "Pareja",
      width: 8,
      color: "#f43f5e",
      desc: "Vínculo romántico o de pareja.",
    },
    {
      id: "hijo",
      label: "Hijo/a · Progenitor",
      short: "Hijo/a",
      width: 7,
      color: "#f59e0b",
      desc: "Madre/padre e hijo/a.",
    },
    {
      id: "sangre",
      label: "Familiar de sangre",
      short: "Sangre",
      width: 5,
      color: "#fb923c",
      desc: "Hermanos, abuelos, tíos o primos.",
    },
    {
      id: "familia",
      label: "Familia extendida",
      short: "Familia",
      width: 4,
      color: "#8b5cf6",
      desc: "Familia política o vínculo lejano.",
    },
    {
      id: "amistad",
      label: "Amistad",
      short: "Amistad",
      width: 2.8,
      color: "#10b981",
      desc: "Amistad cercana o compañerismo.",
    },
    {
      id: "conocido",
      label: "Conocido",
      short: "Conocido",
      width: 1.6,
      color: "#38bdf8",
      desc: "Trato ocasional o alianza.",
    },
  ];
  const REL_BY_ID = Object.fromEntries(REL_TYPES.map((r) => [r.id, r]));
  const FAMILY_TYPES = new Set(["pareja", "hijo", "sangre", "familia"]);

  const GROUP_COLORS = [
    "#f472b6", "#fb923c", "#fbbf24", "#a3e635", "#34d399",
    "#22d3ee", "#60a5fa", "#a78bfa", "#f87171", "#94a3b8",
  ];
  const DEFAULT_GROUP_ID = "grp_principal";
  const DEFAULT_GROUP_NAME = "Mi árbol";

  const ICONS = {
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6.5 7l.8 13h9.4l.8-13M10 11v5M14 11v5"/></svg>',
    link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.3-2.3a4 4 0 0 0-5.7-5.7L11.6 6.7"/><path d="M13.5 10.5a4 4 0 0 0-5.7 0l-2.3 2.3a4 4 0 0 0 5.7 5.7l1.2-1.2"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    tree: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v5M6 21v-4h12v4M6 17v-3h12v3M4 10h4l2-2h4l2 2h4"/></svg>',
    users: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 6.5a3 3 0 0 1 0 5.8M17.5 19a5.5 5.5 0 0 0-2.5-4.6"/></svg>',
    sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15.2A8.5 8.5 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2Z"/></svg>',
    auto: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 0 0 0 18Z" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="9"/></svg>',
  };

  /* ---------------- Utilidades ---------------- */
  const $ = (id) => document.getElementById(id);

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function uid(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function initials(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    const first = parts[0][0] || "";
    const second = parts.length > 1 ? parts[1][0] : "";
    return (first + second).toUpperCase();
  }

  function fold(text) {
    return String(text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function plural(n, singular, pluralWord) {
    return `${n} ${n === 1 ? singular : pluralWord}`;
  }

  function groupById(id) {
    return data.groups.find((group) => group.id === id) || null;
  }

  function activeGroup() {
    return groupById(ui.activeGroupId) || data.groups[0] || null;
  }

  function activeGroupId() {
    const group = activeGroup();
    return group ? group.id : null;
  }

  function peopleInGroup(groupId) {
    return data.people.filter((person) => person.groupId === groupId);
  }

  function relationsInGroup(groupId) {
    const ids = new Set(peopleInGroup(groupId).map((person) => person.id));
    return data.relations.filter((relation) => ids.has(relation.from) && ids.has(relation.to));
  }

  function personById(id) {
    return data.people.find((p) => p.id === id) || null;
  }

  function colorOf(person) {
    const group = person ? groupById(person.groupId) : null;
    return group ? group.color : "#94a3b8";
  }

  function rememberGroupView() {
    const current = activeGroupId();
    if (current) groupViews[current] = { ...(ui.radial ? ui.radial.view : view) };
  }

  function ensureGroup() {
    if (!data.groups.length) {
      data.groups.push({
        id: DEFAULT_GROUP_ID,
        name: DEFAULT_GROUP_NAME,
        color: GROUP_COLORS[0],
      });
    }
    if (!groupById(ui.activeGroupId)) ui.activeGroupId = data.groups[0].id;
    return activeGroup();
  }

  function hexToRgba(hex, alpha) {
    const value = String(hex || "#94a3b8").replace("#", "");
    if (!/^[0-9a-f]{6}$/i.test(value)) return `rgba(148, 163, 184, ${alpha})`;
    const n = parseInt(value, 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  const AVATAR_OUTPUT_SIZE = 512;
  const AVATAR_MAX_FILE_BYTES = 12 * 1024 * 1024;
  const AVATAR_MAX_DATA_LENGTH = 1200000;

  function readStored(key, legacyKey) {
    try {
      const current = window.localStorage.getItem(key);
      if (current != null) return current;
      return legacyKey ? window.localStorage.getItem(legacyKey) : null;
    } catch {
      return null;
    }
  }

  function isSafeImageUrl(value) {
    if (typeof value !== "string") return false;
    const v = value.trim();
    if (!v) return false;
    if (/^data:image\//i.test(v)) return v.length <= AVATAR_MAX_DATA_LENGTH;
    if (v.length > 2000 || !/^(https?:|file:|blob:)/i.test(v)) return false;
    try {
      const url = new URL(v);
      return ["http:", "https:", "file:", "blob:"].includes(url.protocol);
    } catch {
      return false;
    }
  }

  function isRemoteImageUrl(value) {
    return /^(https?:|file:|blob:)/i.test(String(value || "").trim());
  }

  function normalizeView(raw) {
    const x = Number(raw && raw.x);
    const y = Number(raw && raw.y);
    const k = Number(raw && raw.k);
    return {
      x: Number.isFinite(x) ? x : 0,
      y: Number.isFinite(y) ? y : 0,
      k: clamp(Number.isFinite(k) && k > 0 ? k : 1, MIN_ZOOM, MAX_ZOOM),
    };
  }

  function nowStamp() {
    return new Date().toISOString().slice(0, 10);
  }

  /* ---------------- Estado ---------------- */
  let data = { groups: [], people: [], relations: [] };
  let view = { x: 0, y: 0, k: 1 };
  let groupViews = {};
  let saveTimer = null;
  let storageWarned = false;
  let themeMode = "auto";
  let cropState = null;
  let els = {};
  let sync = null;

  const ui = {
    selectedId: null,
    query: "",
    activeGroupId: null,
    viewMode: "family",
    focusRootId: null,
    connect: { active: false, fromId: null, pointer: null },
    drag: null,
    pan: null,
    viewAnim: null,
    suppressClickUntil: 0,
    personEditId: null,
    personPlacement: null,
    avatarDraft: "",
    relationCtx: null,
    groupEditId: null,
    groupColor: GROUP_COLORS[0],
    pointerRaf: null,
    hoverTimer: null,
    hoverCard: null,
    hoverNode: null,
    hoverPersonId: null,
    radial: null,
  };

  /* ---------------- Datos de ejemplo ---------------- */
  function demoData() {
    return {
      groups: [
        { id: "grp_familia", name: "Familia", color: "#34d399" },
      ],
      people: [
        {
          id: "p_kelly",
          name: "Kelly",
          groupId: "grp_familia",
          avatar: "",
          x: 520, y: 120,
          description: "El centro de esta familia. Le gusta reunir a todos alrededor de la mesa, contar historias que crecen cada vez que las repite y asegurarse de que nadie se vaya sin probar el postre.",
        },
        {
          id: "p_bard",
          name: "Bard",
          groupId: "grp_familia",
          avatar: "",
          x: 760, y: 120,
          description: "Pareja de Kelly y padre de sus tres hijas. De carácter tranquilo, es quien pone orden cuando la casa se llena de voces y quien recuerda los cumpleaños que todos los demás olvidan.",
        },
        {
          id: "p_manu",
          name: "Manu",
          groupId: "grp_familia",
          avatar: "",
          x: 260, y: 120,
          description: "Amiga de Kelly desde hace muchos años. Se conocieron por casualidad y desde entonces no han dejado de buscarse: una llamada suya basta para convertir una tarde cualquiera en un plan memorable.",
        },
        {
          id: "p_yana",
          name: "Yana",
          groupId: "grp_familia",
          avatar: "",
          x: 400, y: 430,
          description: "La mayor de las tres hermanas. Curiosa, decidida y con una facilidad sorprendente para organizar a todo el mundo. Suele ser la primera en proponer una aventura y la última en rendirse.",
        },
        {
          id: "p_asya",
          name: "Asya",
          groupId: "grp_familia",
          avatar: "",
          x: 640, y: 430,
          description: "La mediana. Observadora y creativa, prefiere escuchar antes que hablar y tiene un cuaderno lleno de ideas que algún día piensa llevar a cabo. Es el punto de equilibrio entre sus hermanas.",
        },
        {
          id: "p_lila",
          name: "Lila",
          groupId: "grp_familia",
          avatar: "",
          x: 880, y: 430,
          description: "La pequeña de la casa. Alegre, impulsiva y experta en convertir cualquier día gris en una pequeña celebración. Sus hermanas dicen que heredó la energía de Kelly y la calma de Bard.",
        },
        {
          id: "p_sasha",
          name: "Sasha",
          groupId: "grp_familia",
          avatar: "",
          x: 120, y: 430,
          description: "Amiga de Yana. Se entienden con una mirada y comparten la misma debilidad por los planes improvisados. Es la voz que anima a Yana cuando duda y su cómplice favorita cuando la idea vale la pena.",
        },
      ],
      relations: [
        { id: "r_01", from: "p_kelly", to: "p_bard", type: "pareja" },
        { id: "r_02", from: "p_kelly", to: "p_yana", type: "hijo" },
        { id: "r_03", from: "p_bard", to: "p_yana", type: "hijo" },
        { id: "r_04", from: "p_kelly", to: "p_asya", type: "hijo" },
        { id: "r_05", from: "p_bard", to: "p_asya", type: "hijo" },
        { id: "r_06", from: "p_kelly", to: "p_lila", type: "hijo" },
        { id: "r_07", from: "p_bard", to: "p_lila", type: "hijo" },
        { id: "r_08", from: "p_kelly", to: "p_manu", type: "amistad" },
        { id: "r_09", from: "p_yana", to: "p_sasha", type: "amistad" },
      ],
    };
  }

  /* ---------------- Almacenamiento ---------------- */
  function sanitize(raw) {
    const out = { groups: [], people: [], relations: [] };
    if (!raw || typeof raw !== "object") {
      out.groups.push({ id: DEFAULT_GROUP_ID, name: DEFAULT_GROUP_NAME, color: GROUP_COLORS[0] });
      return out;
    }

    const seenGroups = new Set();
    const rawGroups = Array.isArray(raw.groups)
      ? raw.groups.map((group) => [null, group])
      : raw.groups && typeof raw.groups === "object"
        ? Object.entries(raw.groups)
        : [];
    rawGroups.forEach(([key, group], index) => {
      if (!group || typeof group !== "object" || !String(group.name || "").trim()) return;
      const id = String(group.id != null ? group.id : key || `grp_${index + 1}`);
      if (!id || seenGroups.has(id)) return;
      out.groups.push({
        id,
        name: String(group.name).trim().slice(0, 80),
        color: /^#[0-9a-f]{6}$/i.test(String(group.color || ""))
          ? String(group.color)
          : GROUP_COLORS[index % GROUP_COLORS.length],
      });
      seenGroups.add(id);
    });

    if (!out.groups.length) {
      const legacySections = Array.isArray(raw.sections) ? raw.sections : [];
      const family = legacySections.find((section) => section && /familia/i.test(String(section.name || "")));
      out.groups.push({
        id: DEFAULT_GROUP_ID,
        name: family && String(family.name || "").trim()
          ? String(family.name).trim().slice(0, 80)
          : DEFAULT_GROUP_NAME,
        color: family && /^#[0-9a-f]{6}$/i.test(String(family.color || ""))
          ? String(family.color)
          : GROUP_COLORS[0],
      });
    }

    const fallbackGroupId = out.groups[0].id;
    const seenPeople = new Set();
    const rawPeople = Array.isArray(raw.people) ? raw.people : [];
    rawPeople.forEach((p, index) => {
      if (!p || p.id == null || !String(p.name || "").trim()) return;
      const id = String(p.id);
      if (seenPeople.has(id)) return;
      const hasX = p.x != null && Number.isFinite(Number(p.x));
      const hasY = p.y != null && Number.isFinite(Number(p.y));
      const fallbackX = 140 + (index % 4) * 270;
      const fallbackY = 140 + Math.floor(index / 4) * 160;
      let groupId = p.groupId != null ? String(p.groupId) : "";
      if (!seenGroups.has(groupId)) {
        groupId = p.sectionId != null && seenGroups.has(String(p.sectionId))
          ? String(p.sectionId)
          : fallbackGroupId;
      }
      out.people.push({
        id,
        name: String(p.name).trim().slice(0, 80),
        description: typeof p.description === "string" ? p.description.slice(0, 2000) : "",
        groupId,
        avatar: isSafeImageUrl(p.avatar) ? String(p.avatar).trim() : "",
        x: hasX ? clamp(Number(p.x), 24, WORLD_W - NODE_W - 24) : fallbackX,
        y: hasY ? clamp(Number(p.y), 24, WORLD_H - NODE_H - 24) : fallbackY,
      });
      seenPeople.add(id);
    });

    const groupOfPerson = new Map(out.people.map((person) => [person.id, person.groupId]));
    const seenRelations = new Set();
    const seenRelationIds = new Set();
    const rawRelations = Array.isArray(raw.relations) ? raw.relations : [];
    rawRelations.forEach((r) => {
      if (!r) return;
      const from = String(r.from);
      const to = String(r.to);
      if (!seenPeople.has(from) || !seenPeople.has(to) || from === to) return;
      if (!REL_BY_ID[r.type]) return;
      if (groupOfPerson.get(from) !== groupOfPerson.get(to)) return;
      const key = [from, to].sort().join("|");
      if (seenRelations.has(key)) return;
      let id = r.id != null ? String(r.id) : uid("r");
      if (seenRelationIds.has(id)) id = uid("r");
      const label = typeof r.label === "string" ? r.label.trim().slice(0, 40) : "";
      const entry = { id, from, to, type: r.type };
      if (label) entry.label = label;
      out.relations.push(entry);
      seenRelations.add(key);
      seenRelationIds.add(id);
    });

    return out;
  }

  function readStore() {
    try {
      const raw = readStored(STORAGE_KEY, LEGACY_KEYS.wiki);
      if (!raw) return null;
      try {
        if (!window.localStorage.getItem(STORAGE_KEY)) {
          window.localStorage.setItem(STORAGE_KEY, raw);
        }
      } catch {
        /* sin persistencia: seguimos con los datos en memoria */
      }
      const parsed = JSON.parse(raw);
      const legacy =
        !Array.isArray(parsed.groups) ||
        Number(parsed.version || 1) < 2 ||
        (Array.isArray(parsed.people) &&
          parsed.people.some((person) => person && person.groupId == null));
      return {
        data: sanitize(parsed),
        view: parsed && parsed.view ? normalizeView(parsed.view) : null,
        activeGroupId: parsed && parsed.activeGroupId != null ? String(parsed.activeGroupId) : null,
        groupViews: parsed && parsed.groupViews && typeof parsed.groupViews === "object"
          ? parsed.groupViews
          : {},
        legacy,
      };
    } catch (error) {
      console.warn("Nradiowave: no se pudo leer el almacenamiento local.", error);
      return null;
    }
  }

  function saveData({ fromRemote = false } = {}) {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    const currentGroupId = activeGroupId();
    const storedView = ui.radial ? ui.radial.view : view;
    if (currentGroupId) groupViews[currentGroupId] = { ...storedView };
    const payload = {
      app: "nradiowave-rw",
      version: 2,
      savedAt: new Date().toISOString(),
      view: storedView,
      activeGroupId: currentGroupId,
      groupViews,
      groups: data.groups,
      people: peopleForStorage(),
      relations: data.relations,
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      if (!storageWarned) {
        storageWarned = true;
        toast("No se pudo guardar en este navegador. Exporta un respaldo para no perder tus datos.", "error");
      }
      console.warn("Nradiowave: no se pudo guardar.", error);
    }
    if (!fromRemote) queueSync();
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      saveData();
    }, 450);
  }

  /* ---------------- Sincronización compartida ----------------
     El árbol vive en Firebase Realtime Database. Las reglas del
     proyecto permiten leer y escribir sin cuenta: quien tenga el
     enlace puede editar. Cada cambio se envía por rutas concretas
     (PATCH) para no reenviar las fotos de todo el árbol. */
  function emptyRemote() {
    return { groups: [], people: {}, relations: {} };
  }

  function syncKeyMap(items) {
    const map = {};
    items.forEach((item) => {
      let key = String(item.id).replace(/[.#$/\[\]]/g, "_");
      if (!key) key = "item";
      let candidate = key;
      let suffix = 2;
      while (map[candidate] && String(map[candidate].id) !== String(item.id)) {
        candidate = `${key}_${suffix}`;
        suffix += 1;
      }
      map[candidate] = { ...item };
    });
    return map;
  }

  function localSnapshot() {
    return {
      groups: data.groups.map((group) => ({ ...group })),
      people: syncKeyMap(peopleForStorage()),
      relations: syncKeyMap(data.relations),
    };
  }

  function normalizeRemote(raw) {
    const out = emptyRemote();
    if (!raw || typeof raw !== "object") return out;

    const rawGroups = Array.isArray(raw.groups)
      ? raw.groups.map((group) => [null, group])
      : raw.groups && typeof raw.groups === "object"
        ? Object.entries(raw.groups)
        : [];
    rawGroups.forEach(([key, group], index) => {
      if (!group || typeof group !== "object") return;
      const id = String(group.id != null ? group.id : key || `grp_${index + 1}`);
      if (!id) return;
      out.groups.push({ ...group, id });
    });

    const collect = (source, target) => {
      if (!source || typeof source !== "object") return;
      Object.entries(source).forEach(([key, value]) => {
        if (!value || typeof value !== "object") return;
        target[key] = { ...value };
      });
    };
    collect(raw.people, out.people);
    collect(raw.relations, out.relations);

    if (!out.groups.length) {
      const legacySections = Array.isArray(raw.sections)
        ? raw.sections
        : raw.sections && typeof raw.sections === "object"
          ? Object.values(raw.sections)
          : [];
      const family = legacySections.find((section) => section && /familia/i.test(String(section.name || "")));
      if (Object.keys(out.people).length || legacySections.length) {
        out.groups.push({
          id: DEFAULT_GROUP_ID,
          name: family && String(family.name || "").trim()
            ? String(family.name).trim().slice(0, 80)
            : DEFAULT_GROUP_NAME,
          color: family && /^#[0-9a-f]{6}$/i.test(String(family.color || ""))
            ? String(family.color)
            : GROUP_COLORS[0],
        });
        Object.defineProperty(out, "legacy", { value: true, configurable: true });
      }
    }

    const fallbackGroupId = out.groups[0] ? out.groups[0].id : null;
    const groupIds = new Set(out.groups.map((group) => group.id));
    const missingGroupIds = [];
    Object.entries(out.people).forEach(([key, person]) => {
      const hadGroup = person.groupId != null && groupIds.has(String(person.groupId));
      let groupId = person.groupId != null ? String(person.groupId) : "";
      if (!groupIds.has(groupId)) groupId = fallbackGroupId;
      if (groupId) person.groupId = groupId;
      if (!hadGroup) missingGroupIds.push(key);
    });
    Object.defineProperty(out, "missingGroupIds", {
      value: missingGroupIds,
      configurable: true,
    });
    return out;
  }

  function remoteToLocal(remote) {
    const people = Object.entries(remote.people).map(([key, person]) => ({
      ...person,
      id: person && person.id != null ? person.id : key,
    }));
    const relations = Object.entries(remote.relations).map(([key, relation]) => ({
      ...relation,
      id: relation && relation.id != null ? relation.id : key,
    }));
    return sanitize({ groups: remote.groups, people, relations });
  }

  function stable(value) {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable(value[key])}`)
      .join(",")}}`;
  }

  function diffRemote(prev, next) {
    const patch = {};
    if (stable(prev.groups) !== stable(next.groups)) {
      patch.groups = next.groups;
    }
    Object.entries(next.people).forEach(([key, person]) => {
      if (stable(prev.people[key]) !== stable(person)) patch[`people/${key}`] = person;
    });
    Object.keys(prev.people).forEach((key) => {
      if (!(key in next.people)) patch[`people/${key}`] = null;
    });
    Object.entries(next.relations).forEach(([key, relation]) => {
      if (stable(prev.relations[key]) !== stable(relation)) patch[`relations/${key}`] = relation;
    });
    Object.keys(prev.relations).forEach((key) => {
      if (!(key in next.relations)) patch[`relations/${key}`] = null;
    });
    return patch;
  }

  function setRemotePath(remote, path, value) {
    const parts = String(path || "")
      .split("/")
      .filter(Boolean);
    if (!parts.length) {
      if (value && typeof value === "object") {
        const normalized = normalizeRemote(value);
        remote.groups = normalized.groups;
        remote.people = normalized.people;
        remote.relations = normalized.relations;
      } else {
        remote.groups = [];
        remote.people = {};
        remote.relations = {};
      }
      return;
    }
    let cursor = remote;
    for (let index = 0; index < parts.length - 1; index += 1) {
      const part = parts[index];
      if (!cursor[part] || typeof cursor[part] !== "object") cursor[part] = {};
      cursor = cursor[part];
    }
    const last = parts[parts.length - 1];
    if (value === null || value === undefined) delete cursor[last];
    else cursor[last] = value;
  }

  function applyPatch(remote, patch) {
    Object.entries(patch).forEach(([path, value]) => setRemotePath(remote, path, value));
  }

  function isBusyForSync() {
    return Boolean(
      ui.pan ||
        ui.connect.active ||
        cropState ||
        document.querySelector(".node.dragging") ||
        document.querySelector("dialog[open]")
    );
  }

  function applyRemoteSnapshot(remote, { initial = false } = {}) {
    if (!sync) return;
    if (!initial && isBusyForSync()) {
      sync.deferred = remote;
      scheduleDeferredApply();
      return;
    }
    sync.deferred = null;
    sync.remote = remote;

    const effective = {
      groups: remote.groups.slice(),
      people: { ...remote.people },
      relations: { ...remote.relations },
    };
    if (Object.keys(sync.pending).length) applyPatch(effective, sync.pending);

    const next = remoteToLocal(effective);
    sync.lastAt = Date.now();
    const changed = stable(next) !== stable(data);
    if (changed) {
      data = next;
      if (!data.groups.some((group) => group.id === ui.activeGroupId)) {
        ui.activeGroupId = data.groups[0] ? data.groups[0].id : null;
      }
      const active = activeGroup();
      const selected = ui.selectedId ? personById(ui.selectedId) : null;
      if (!selected || !active || selected.groupId !== active.id) {
        ui.selectedId = null;
      }
      const focused = ui.focusRootId ? personById(ui.focusRootId) : null;
      if (!focused || !active || focused.groupId !== active.id) {
        ui.focusRootId = null;
      }
      if (ui.radial) {
        ui.radial = null;
        if (ui.selectedId && personById(ui.selectedId)) applyRadialLayout(ui.selectedId);
      }
      Object.keys(groupViews).forEach((groupId) => {
        if (!data.groups.some((group) => group.id === groupId)) delete groupViews[groupId];
      });
      renderAll();
      saveData({ fromRemote: true });
    }
    renderSyncStatus();
    if (changed && !initial) {
      toast("El árbol se actualizó desde otro dispositivo.", "info");
    }
  }

  function scheduleDeferredApply() {
    if (!sync || sync.deferTimer) return;
    sync.deferTimer = window.setTimeout(() => {
      if (!sync) return;
      sync.deferTimer = null;
      const pendingRemote = sync.deferred;
      if (!pendingRemote) return;
      if (isBusyForSync()) {
        scheduleDeferredApply();
        return;
      }
      applyRemoteSnapshot(pendingRemote);
    }, 450);
  }

  function readPending() {
    try {
      const raw = JSON.parse(readStored(PENDING_KEY) || "{}");
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
      const legacy = Object.prototype.hasOwnProperty.call(raw, "sections") ||
        Object.entries(raw).some(([key, value]) =>
          /^people\//.test(key) && value && typeof value === "object" && !value.groupId
        );
      if (legacy) {
        console.warn("Nradiowave: se descartan cambios pendientes del formato anterior.");
        try {
          window.localStorage.removeItem(PENDING_KEY);
        } catch {
          /* sin persistencia */
        }
        return {};
      }
      return raw;
    } catch {
      return {};
    }
  }

  function writePending() {
    if (!sync) return;
    try {
      if (Object.keys(sync.pending).length) {
        window.localStorage.setItem(PENDING_KEY, JSON.stringify(sync.pending));
      } else {
        window.localStorage.removeItem(PENDING_KEY);
      }
    } catch {
      /* sin persistencia: el árbol sigue en memoria */
    }
  }

  function renderSyncStatus() {
    if (!sync || !els.syncStatus) return;
    const labels = {
      local: "Guardado en este navegador",
      connecting: "Conectando…",
      online: "Sincronizado",
      saving: "Guardando cambios…",
      offline: "Sin conexión · se reintentará",
      waiting: "Esperando árbol compartido…",
    };
    const text = labels[sync.state] || labels.local;
    const label = els.syncStatus.querySelector(".sync-text");
    if (label) label.textContent = text;
    els.syncStatus.dataset.state = sync.state;
    els.syncStatus.title = sync.enabled
      ? sync.lastAt
        ? `Última sincronización: ${new Date(sync.lastAt).toLocaleTimeString()}`
        : "Sincronización activa"
      : "Los datos se guardan solo en este dispositivo";
  }

  function setSyncState(state) {
    if (!sync) return;
    sync.state = state;
    renderSyncStatus();
  }

  function scheduleSyncRetry(handler) {
    if (!sync || sync.retryTimer) return;
    const delay = sync.retryDelay;
    sync.retryDelay = Math.min(Math.round(sync.retryDelay * 1.7), 60000);
    sync.retryTimer = window.setTimeout(() => {
      if (!sync) return;
      sync.retryTimer = null;
      handler();
    }, delay);
  }

  function queueSync() {
    if (!sync || !sync.enabled || !sync.ready) return;
    if (sync.blockWrites && isDemoWorkspace()) return;
    if (sync.blockWrites) sync.blockWrites = false;

    const snapshot = localSnapshot();
    const patch = diffRemote(sync.remote, snapshot);
    if (sync.legacyRemote) {
      patch.groups = data.groups.map((group) => ({ ...group }));
      patch.sections = null;
      sync.legacyRemote = false;
    }
    if (sync.missingGroupIds.length) {
      sync.missingGroupIds.forEach((key) => {
        if (snapshot.people[key]) patch[`people/${key}`] = snapshot.people[key];
      });
      sync.missingGroupIds = [];
    }
    if (!Object.keys(patch).length) return;
    Object.assign(sync.pending, patch);
    writePending();
    setSyncState("saving");

    if (sync.sendTimer) window.clearTimeout(sync.sendTimer);
    sync.sendTimer = window.setTimeout(() => {
      if (!sync) return;
      sync.sendTimer = null;
      flushSync();
    }, 700);
  }

  async function flushSync({ keepalive = false } = {}) {
    if (!sync || !sync.enabled || !sync.ready) return;
    if (sync.sendTimer) {
      window.clearTimeout(sync.sendTimer);
      sync.sendTimer = null;
    }
    if (!Object.keys(sync.pending).length) {
      if (sync.state === "saving") setSyncState("online");
      return;
    }
    if (sync.sending) return;
    await sendPending({ keepalive });
  }

  async function sendPending({ keepalive = false } = {}) {
    if (!sync || !sync.enabled || !sync.ready) return;
    const sent = { ...sync.pending };
    if (!Object.keys(sent).length) return;

    const revision = sync.version;
    sync.sending = true;
    setSyncState("saving");

    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timeout = controller
      ? window.setTimeout(() => controller.abort(), 15000)
      : null;
    try {
      const response = await fetch(`${SYNC_URL}/${SYNC_PATH}.json`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sent),
        keepalive,
        cache: "no-store",
        signal: controller ? controller.signal : undefined,
      });
      if (timeout) window.clearTimeout(timeout);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      Object.keys(sent).forEach((key) => {
        if (stable(sync.pending[key]) === stable(sent[key])) delete sync.pending[key];
      });
      writePending();
      if (sync.version === revision) applyPatch(sync.remote, sent);
      sync.lastAt = Date.now();
      sync.retryDelay = 4000;
      sync.sending = false;
      renderSyncStatus();

      if (Object.keys(sync.pending).length) {
        sync.sendTimer = window.setTimeout(() => {
          if (!sync) return;
          sync.sendTimer = null;
          flushSync();
        }, 200);
      } else {
        setSyncState("online");
      }
    } catch (error) {
      if (timeout) window.clearTimeout(timeout);
      sync.sending = false;
      writePending();
      setSyncState("offline");
      scheduleSyncRetry(() => flushSync());
    }
  }

  function parseStreamEvent(raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function markSyncAlive() {
    if (!sync) return;
    if (Object.keys(sync.pending).length) setSyncState("saving");
    else setSyncState("online");
  }

  function handleStreamPut(payload) {
    if (!sync || !payload || typeof payload !== "object") return;
    sync.version += 1;
    const path = String(payload.path || "/").replace(/\/+$/, "") || "/";
    if (path === "/") {
      if (payload.data == null) {
        if (!sync.ready) return;
        const hadData =
          (sync.remote.groups && sync.remote.groups.length) ||
          Object.keys(sync.remote.people || {}).length ||
          Object.keys(sync.remote.relations || {}).length;
        if (!hadData) return;
        sync.blockWrites = false;
        applyRemoteSnapshot(emptyRemote());
        markSyncAlive();
      } else {
        sync.blockWrites = false;
        const remote = normalizeRemote(payload.data);
        if (remote.legacy) sync.legacyRemote = true;
        if (remote.missingGroupIds && remote.missingGroupIds.length) {
          sync.missingGroupIds = remote.missingGroupIds.slice();
          queueSync();
        }
        applyRemoteSnapshot(remote);
        markSyncAlive();
      }
      return;
    }
    const next = sync.remote || emptyRemote();
    setRemotePath(next, path.slice(1), payload.data === undefined ? null : payload.data);
    applyRemoteSnapshot(next);
    markSyncAlive();
  }

  function handleStreamPatch(payload) {
    if (!sync || !payload || typeof payload !== "object" || !payload.data) return;
    sync.version += 1;
    const base = String(payload.path || "/")
      .replace(/^\//, "")
      .replace(/\/+$/, "");
    const next = sync.remote || emptyRemote();
    Object.entries(payload.data).forEach(([relative, value]) => {
      setRemotePath(next, base ? `${base}/${relative}` : relative, value);
    });
    applyRemoteSnapshot(next);
    markSyncAlive();
  }

  function armStreamWatchdog(source) {
    if (!sync) return;
    if (sync.watchdog) window.clearTimeout(sync.watchdog);
    sync.watchdog = window.setTimeout(() => {
      if (!sync || sync.source !== source) return;
      if (source.readyState === 1) return;
      try {
        source.close();
      } catch {
        /* ya cerrado */
      }
      sync.source = null;
      connectSyncStream();
      loadRemote();
    }, 9000);
  }

  function connectSyncStream() {
    if (!sync || !sync.enabled) return;
    if (!("EventSource" in window)) return;
    if (sync.watchdog) {
      window.clearTimeout(sync.watchdog);
      sync.watchdog = null;
    }
    if (sync.source) {
      try {
        sync.source.close();
      } catch {
        /* nada que cerrar */
      }
    }

    let source;
    try {
      source = new EventSource(`${SYNC_URL}/${SYNC_PATH}.json`);
    } catch {
      scheduleSyncRetry(connectSyncStream);
      return;
    }
    sync.source = source;

    source.addEventListener("open", () => {
      if (!sync) return;
      if (sync.watchdog) {
        window.clearTimeout(sync.watchdog);
        sync.watchdog = null;
      }
      if (sync.blockWrites) {
        setSyncState("waiting");
      } else if (Object.keys(sync.pending).length) {
        setSyncState("saving");
        flushSync();
      } else {
        setSyncState("online");
      }
    });
    source.addEventListener("put", (event) => {
      const payload = parseStreamEvent(event.data);
      if (payload) handleStreamPut(payload);
    });
    source.addEventListener("patch", (event) => {
      const payload = parseStreamEvent(event.data);
      if (payload) handleStreamPatch(payload);
    });
    source.addEventListener("keep-alive", () => {});
    source.addEventListener("cancel", () => {
      if (!sync) return;
      try {
        source.close();
      } catch {
        /* ya cerrado */
      }
      sync.source = null;
      setSyncState("offline");
      scheduleSyncRetry(() => {
        connectSyncStream();
        loadRemote();
      });
    });
    source.addEventListener("error", () => {
      if (!sync) return;
      if (sync.state !== "offline") setSyncState("offline");
      armStreamWatchdog(source);
    });
  }

  function canSeedRemote() {
    return !isDemoWorkspace() && data.people.length > 0;
  }

  async function loadRemote() {
    if (!sync || !sync.enabled) return;
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timeout = controller
      ? window.setTimeout(() => controller.abort(), 15000)
      : null;
    try {
      const response = await fetch(`${SYNC_URL}/${SYNC_PATH}.json`, {
        cache: "no-store",
        signal: controller ? controller.signal : undefined,
      });
      if (timeout) window.clearTimeout(timeout);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const raw = await response.json();

      if (raw == null) {
        sync.remote = emptyRemote();
        sync.ready = true;
        if (Object.keys(sync.pending).length) {
          flushSync();
        } else if (canSeedRemote()) {
          queueSync();
        } else {
          sync.blockWrites = true;
          setSyncState("waiting");
        }
        return;
      }

      const remote = normalizeRemote(raw);
      if (remote.legacy) sync.legacyRemote = true;
      if (remote.missingGroupIds && remote.missingGroupIds.length) {
        sync.missingGroupIds = remote.missingGroupIds.slice();
      }
      if (Object.keys(sync.pending).length) applyPatch(remote, sync.pending);
      sync.ready = true;
      sync.blockWrites = false;
      applyRemoteSnapshot(remote, { initial: true });
      setSyncState("online");
      if (Object.keys(sync.pending).length) flushSync();
      if (sync.legacyRemote || sync.missingGroupIds.length) queueSync();
    } catch {
      if (timeout) window.clearTimeout(timeout);
      setSyncState("offline");
      scheduleSyncRetry(loadRemote);
    }
  }

  function startSync() {
    sync = {
      enabled: Boolean(SYNC_URL),
      ready: false,
      blockWrites: false,
      state: "local",
      remote: emptyRemote(),
      pending: readPending(),
      source: null,
      sending: false,
      sendTimer: null,
      retryTimer: null,
      retryDelay: 4000,
      deferTimer: null,
      deferred: null,
      watchdog: null,
      legacyRemote: false,
      missingGroupIds: [],
      version: 0,
      lastAt: 0,
    };
    renderSyncStatus();
    if (!sync.enabled) return;

    setSyncState(Object.keys(sync.pending).length ? "saving" : "connecting");
    connectSyncStream();
    loadRemote();

    window.addEventListener("pagehide", () => {
      if (!sync || !sync.enabled) return;
      if (Object.keys(sync.pending).length) sendPending({ keepalive: true });
    });
  }

  function cacheDom() {
    els = {
      app: $("app"),
      menuBtn: $("menuBtn"),
      importBtn: $("importBtn"),
      exportBtn: $("exportBtn"),
      helpBtn: $("helpBtn"),
      themeBtn: $("themeBtn"),
      detailToggleBtn: $("detailToggleBtn"),
      addPersonBtn: $("addPersonBtn"),
      fileInput: $("fileInput"),
      sidebar: $("sidebar"),
      peopleCount: $("peopleCount"),
      groupsCount: $("groupsCount"),
      activeGroupLabel: $("activeGroupLabel"),
      searchInput: $("searchInput"),
      peopleList: $("peopleList"),
      addGroupBtn: $("addGroupBtn"),
      groupList: $("groupList"),
      openHelpLink: $("openHelpLink"),
      syncStatus: $("syncStatus"),
      canvasArea: $("canvasArea"),
      viewport: $("viewport"),
      world: $("world"),
      edgeLayer: $("edgeLayer"),
      nodeLayer: $("nodeLayer"),
      canvasAddBtn: $("canvasAddBtn"),
      connectBtn: $("connectBtn"),
      familyViewBtn: $("familyViewBtn"),
      allViewBtn: $("allViewBtn"),
      organizeBtn: $("organizeBtn"),
      focusBar: $("focusBar"),
      focusBackBtn: $("focusBackBtn"),
      focusTitle: $("focusTitle"),
      focusMeta: $("focusMeta"),
      connectHint: $("connectHint"),
      emptyState: $("emptyState"),
      emptyAddBtn: $("emptyAddBtn"),
      emptyDemoBtn: $("emptyDemoBtn"),
      zoomInBtn: $("zoomInBtn"),
      zoomOutBtn: $("zoomOutBtn"),
      fitBtn: $("fitBtn"),
      zoomPct: $("zoomPct"),
      detail: $("detail"),
      scrim: $("scrim"),
      toastHost: $("toastHost"),
      personDialog: $("personDialog"),
      personForm: $("personForm"),
      personDialogEyebrow: $("personDialogEyebrow"),
      personDialogTitle: $("personDialogTitle"),
      personName: $("personName"),
      personGroup: $("personGroup"),
      personAvatar: $("personAvatar"),
      personAvatarFile: $("personAvatarFile"),
      personAvatarUrl: $("personAvatarUrl"),
      personAvatarUrlDetails: $("personAvatarUrlDetails"),
      personAvatarPreview: $("personAvatarPreview"),
      personAvatarUpload: $("personAvatarUpload"),
      personAvatarAdjust: $("personAvatarAdjust"),
      personAvatarClear: $("personAvatarClear"),
      personAvatarHelp: $("personAvatarHelp"),
      personDesc: $("personDesc"),
      personDeleteBtn: $("personDeleteBtn"),
      avatarCropDialog: $("avatarCropDialog"),
      avatarCropClose: $("avatarCropClose"),
      avatarCropCancel: $("avatarCropCancel"),
      avatarCropApply: $("avatarCropApply"),
      cropStage: $("cropStage"),
      cropImage: $("cropImage"),
      cropZoom: $("cropZoom"),
      cropZoomValue: $("cropZoomValue"),
      relationDialog: $("relationDialog"),
      relationDialogTitle: $("relationDialogTitle"),
      relationNames: $("relationNames"),
      relationTypes: $("relationTypes"),
      relLabel: $("relLabel"),
      relationDeleteBtn: $("relationDeleteBtn"),
      relationSaveBtn: $("relationSaveBtn"),
      groupDialog: $("groupDialog"),
      groupForm: $("groupForm"),
      groupDialogTitle: $("groupDialogTitle"),
      groupName: $("groupName"),
      groupColors: $("groupColors"),
      groupDeleteBtn: $("groupDeleteBtn"),
      helpDialog: $("helpDialog"),
      helpLegend: $("helpLegend"),
      helpExportBtn: $("helpExportBtn"),
      helpImportBtn: $("helpImportBtn"),
      helpShareBtn: $("helpShareBtn"),
      helpDemoBtn: $("helpDemoBtn"),
      helpResetBtn: $("helpResetBtn"),
      confirmDialog: $("confirmDialog"),
      confirmTitle: $("confirmTitle"),
      confirmMessage: $("confirmMessage"),
      confirmOkBtn: $("confirmOkBtn"),
      confirmCancelBtn: $("confirmCancelBtn"),
    };
  }

  /* ---------------- Constructores de UI ---------------- */
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function svgEl(tag, attrs = {}) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  }

  function paintAvatar(element, person) {
    const color = colorOf(person);
    element.style.setProperty("--node-color", color);
    element.style.setProperty("--avatar-bg", hexToRgba(color, 0.15));
    element.style.setProperty("--avatar-ring", hexToRgba(color, 0.32));
    element.textContent = initials(person.name);
    if (person.avatar) {
      const img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      img.src = person.avatar;
      img.addEventListener("error", () => img.remove());
      element.appendChild(img);
    }
  }

  function buildLegend(container, detailed = false) {
    container.innerHTML = "";
    REL_TYPES.forEach((rel) => {
      const row = el("div", "legend-row");
      const wrap = el("div", "legend-line-wrap");
      const line = el("span", "legend-line");
      const height = Math.max(2, rel.width);
      line.style.height = `${height}px`;
      if (FAMILY_TYPES.has(rel.id)) {
        line.style.background = rel.color;
      } else {
        line.style.background = `repeating-linear-gradient(90deg, ${rel.color} 0 6px, transparent 6px 10px)`;
      }
      wrap.appendChild(line);
      row.appendChild(wrap);
      row.appendChild(el("span", "legend-name", rel.label));
      if (detailed) row.appendChild(el("span", "legend-desc", rel.desc));
      else row.title = rel.desc;
      container.appendChild(row);
    });
  }

  function isNarrow() {
    return window.matchMedia("(max-width: 1080px)").matches;
  }

  function isFamilyRelation(relation) {
    return !!relation && FAMILY_TYPES.has(relation.type);
  }

  function isSocialRelation(relation) {
    return !!relation && !FAMILY_TYPES.has(relation.type);
  }

  function relationWeight(relation) {
    const config = (relation && REL_BY_ID[relation.type]) || REL_BY_ID.conocido;
    return clamp(10 / Math.max(1, config.width), 1, 8);
  }

  function relationDisplayLabel(relation) {
    const custom = relation && typeof relation.label === "string" ? relation.label.trim() : "";
    if (custom) return custom;
    const config = relation ? REL_BY_ID[relation.type] : null;
    return config ? config.label : "Vínculo";
  }

  function shortLabel(text, max = 20) {
    const value = String(text || "").trim();
    if (value.length <= max) return value;
    return `${value.slice(0, max - 1).trimEnd()}…`;
  }

  function relationsOf(personId) {
    return data.relations.filter((relation) => relation.from === personId || relation.to === personId);
  }

  function directSocialIds(personId) {
    const ids = new Set();
    relationsOf(personId).forEach((relation) => {
      if (!isSocialRelation(relation)) return;
      ids.add(relation.from === personId ? relation.to : relation.from);
    });
    return ids;
  }

  function socialEntries(person) {
    if (!person) return [];
    return relationsOf(person.id)
      .filter(isSocialRelation)
      .map((relation) => {
        const otherId = relation.from === person.id ? relation.to : relation.from;
        const other = personById(otherId);
        return other ? { relation, other, config: REL_BY_ID[relation.type] } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.config.width - a.config.width || a.other.name.localeCompare(b.other.name, "es"));
  }

  function familyComponentIds(rootId) {
    const ids = new Set();
    const root = personById(rootId);
    if (!root) return ids;
    const adjacency = new Map();
    relationsInGroup(root.groupId).forEach((relation) => {
      if (!isFamilyRelation(relation)) return;
      if (!adjacency.has(relation.from)) adjacency.set(relation.from, new Set());
      if (!adjacency.has(relation.to)) adjacency.set(relation.to, new Set());
      adjacency.get(relation.from).add(relation.to);
      adjacency.get(relation.to).add(relation.from);
    });
    const queue = [rootId];
    ids.add(rootId);
    while (queue.length) {
      const id = queue.shift();
      const neighbors = adjacency.get(id);
      if (!neighbors) continue;
      neighbors.forEach((neighborId) => {
        if (ids.has(neighborId) || !personById(neighborId)) return;
        ids.add(neighborId);
        queue.push(neighborId);
      });
    }
    return ids;
  }

  function focusedPerson() {
    const person = ui.focusRootId ? personById(ui.focusRootId) : null;
    const group = activeGroup();
    if (!person || !group || person.groupId !== group.id) return null;
    return person;
  }

  function visiblePersonIds() {
    const ids = new Set();
    const group = activeGroup();
    if (!group) return ids;
    const scoped = peopleInGroup(group.id);
    if (!scoped.length) return ids;

    const root = focusedPerson();
    if (root) {
      const family = familyComponentIds(root.id);
      if (family.size > 1) {
        family.forEach((id) => ids.add(id));
      } else {
        ids.add(root.id);
        directSocialIds(root.id).forEach((id) => ids.add(id));
      }
      return ids;
    }

    if (ui.viewMode === "all") {
      scoped.forEach((person) => ids.add(person.id));
      return ids;
    }

    const relations = relationsInGroup(group.id);
    const familyIds = new Set();
    let familyCount = 0;
    relations.forEach((relation) => {
      if (!isFamilyRelation(relation)) return;
      familyCount += 1;
      familyIds.add(relation.from);
      familyIds.add(relation.to);
    });

    scoped.forEach((person) => {
      const links = relationsOf(person.id);
      if (!familyCount || familyIds.has(person.id) || !links.length) ids.add(person.id);
    });

    if (ui.selectedId && scoped.some((person) => person.id === ui.selectedId)) ids.add(ui.selectedId);
    return ids;
  }

  function visiblePeople() {
    const group = activeGroup();
    if (!group) return [];
    const ids = visiblePersonIds();
    return peopleInGroup(group.id).filter((person) => ids.has(person.id));
  }

  function visibleRelations() {
    const group = activeGroup();
    if (!group) return [];
    const ids = visiblePersonIds();
    const root = focusedPerson();
    let list = relationsInGroup(group.id).filter((relation) => ids.has(relation.from) && ids.has(relation.to));

    if (root) {
      const socialMode = familyComponentIds(root.id).size <= 1;
      list = list.filter((relation) => {
        if (socialMode) {
          return isSocialRelation(relation) && (relation.from === root.id || relation.to === root.id);
        }
        return isFamilyRelation(relation);
      });
      return list;
    }

    if (ui.viewMode === "family") list = list.filter(isFamilyRelation);
    return list;
  }

  function hiddenSocialCount() {
    if (ui.viewMode !== "family" || ui.focusRootId) return 0;
    const group = activeGroup();
    if (!group) return 0;
    const visible = visiblePersonIds();
    return peopleInGroup(group.id).filter((person) => !visible.has(person.id)).length;
  }

  function renderPeopleList() {
    els.peopleList.innerHTML = "";
    const group = activeGroup();
    const query = fold(ui.query);
    let people = group ? peopleInGroup(group.id) : [];

    if (query) {
      people = people.filter((person) => {
        const haystack = fold(`${person.name} ${person.description} ${group ? group.name : ""}`);
        return haystack.includes(query);
      });
    }

    people = [...people].sort((a, b) => a.name.localeCompare(b.name, "es"));

    if (!group) {
      els.peopleList.appendChild(el("p", "list-empty", "Crea un grupo de familia para empezar."));
      return;
    }
    if (!peopleInGroup(group.id).length) {
      els.peopleList.appendChild(el("p", "list-empty", "Este grupo aún no tiene personajes. Crea el primero para empezar su árbol."));
      return;
    }
    if (!people.length) {
      els.peopleList.appendChild(el("p", "list-empty", "No hay personajes que coincidan con esta búsqueda."));
      return;
    }

    people.forEach((person) => {
      const row = el("button", "person-row");
      row.type = "button";
      if (ui.selectedId === person.id) row.classList.add("active");
      row.title = person.name;

      const avatar = el("span", "mini-avatar");
      paintAvatar(avatar, person);

      const copy = el("span", "person-row-copy");
      copy.appendChild(el("span", "person-row-name", person.name));
      const links = relationsOf(person.id);
      const social = links.filter(isSocialRelation).length;
      let sub = links.length ? plural(links.length, "vínculo", "vínculos") : "Sin vínculos";
      if (social) sub += ` · ${plural(social, "contacto", "contactos")}`;
      copy.appendChild(el("span", "person-row-sub", sub));

      row.append(avatar, copy);
      row.addEventListener("click", () => {
        if (ui.focusRootId) {
          ui.focusRootId = null;
          ui.viewMode = "all";
          renderAll();
        }
        selectPerson(person.id);
        focusPerson(person.id);
        if (isNarrow()) {
          els.app.classList.remove("left-open");
          els.app.classList.add("detail-open");
        }
      });
      els.peopleList.appendChild(row);
    });
  }

  function makeGroupRow({ name, color, count, links, active, onClick, onEdit }) {
    const row = el("div", "section-row group-row");
    if (active) row.classList.add("active");

    const main = el("button", "section-main");
    main.type = "button";
    main.title = `${plural(count, "personaje", "personajes")} · ${plural(links, "vínculo", "vínculos")}`;
    main.setAttribute("aria-pressed", String(active));
    const dot = el("span", "section-dot");
    dot.style.setProperty("--dot", color);
    dot.style.background = color;
    const label = el("span", "section-name", name);
    const counter = el("span", "section-count", String(count));
    main.append(dot, label, counter);
    main.addEventListener("click", onClick);
    row.appendChild(main);

    if (onEdit) {
      const edit = el("button", "section-edit");
      edit.type = "button";
      edit.title = `Editar ${name}`;
      edit.setAttribute("aria-label", `Editar el grupo ${name}`);
      edit.innerHTML = ICONS.edit;
      edit.addEventListener("click", (event) => {
        event.stopPropagation();
        onEdit();
      });
      row.appendChild(edit);
    }

    return row;
  }

  function renderGroups() {
    const list = els.groupList;
    list.innerHTML = "";

    data.groups.forEach((group) => {
      const people = peopleInGroup(group.id);
      list.appendChild(
        makeGroupRow({
          name: group.name,
          color: group.color,
          count: people.length,
          links: relationsInGroup(group.id).length,
          active: activeGroupId() === group.id,
          onClick: () => setActiveGroup(group.id),
          onEdit: () => openGroupDialog(group.id),
        })
      );
    });

    if (!data.groups.length) {
      list.appendChild(el("p", "list-empty", "Crea un grupo de familia para empezar un árbol nuevo."));
    }
  }

  function groupChip(group) {
    const chip = el("span", "section-chip");
    if (group) {
      chip.style.setProperty("--chip-color", group.color);
      chip.style.setProperty("--chip-bg", hexToRgba(group.color, 0.1));
      chip.style.setProperty("--chip-border", hexToRgba(group.color, 0.25));
      const dot = el("span", "chip-dot");
      chip.append(dot, document.createTextNode(group.name));
    } else {
      chip.style.setProperty("--chip-color", "#8a94a6");
      chip.append(document.createTextNode("Sin grupo"));
    }
    return chip;
  }

  function buildDetailPlaceholder() {
    const scroll = el("div", "detail-scroll");
    const empty = el("div", "detail-empty");

    const art = el("div", "orphan-art");
    art.innerHTML =
      '<svg viewBox="0 0 190 112" fill="none">' +
      '<path d="M28 80 68 38l44 26 50-42" stroke="currentColor" stroke-opacity=".3" stroke-width="1.2" stroke-dasharray="3 5"/>' +
      '<path d="M68 38 88 94M112 64l-24 30M68 38 34 18" stroke="currentColor" stroke-opacity=".18" stroke-width="1.1"/>' +
      '<circle cx="28" cy="80" r="5" fill="currentColor" fill-opacity=".9"/>' +
      '<circle cx="68" cy="38" r="7" fill="currentColor"/>' +
      '<circle cx="112" cy="64" r="4" fill="currentColor" fill-opacity=".55"/>' +
      '<circle cx="162" cy="22" r="5.5" fill="currentColor" fill-opacity=".8"/>' +
      '<circle cx="88" cy="94" r="2.6" fill="currentColor" fill-opacity=".45"/>' +
      '<circle cx="34" cy="18" r="2.2" fill="currentColor" fill-opacity=".35"/>' +
      "</svg>";

    empty.appendChild(art);
    empty.appendChild(el("h2", null, "Explora el árbol"));
    empty.appendChild(
      el("p", null, "Haz clic en una tarjeta para abrir su ficha de wiki y descubrir sus vínculos más cercanos.")
    );

    const legendCard = el("div", "legend-card");
    legendCard.appendChild(el("h3", null, "Grosor = cercanía"));
    const legend = el("div", "legend");
    buildLegend(legend, false);
    legendCard.appendChild(legend);
    empty.appendChild(legendCard);

    const tip = el("p", "detail-tip");
    tip.innerHTML = "Doble clic en el lienzo para crear una persona en ese punto, o pulsa <kbd>N</kbd> para añadirla.";
    empty.appendChild(tip);

    const currentGroup = activeGroup();
    if (currentGroup && peopleInGroup(currentGroup.id).length) {
      const peopleCount = peopleInGroup(currentGroup.id).length;
      const relationCount = relationsInGroup(currentGroup.id).length;
      const stats = el(
        "p",
        "detail-tip",
        `${plural(peopleCount, "personaje", "personajes")} · ${plural(relationCount, "vínculo", "vínculos")}`
      );
      empty.appendChild(stats);
    }

    scroll.appendChild(empty);
    return scroll;
  }

  function buildHero(person) {
    const group = groupById(person.groupId);
    const color = colorOf(person);
    const hero = el("div", "hero");
    hero.style.setProperty("--hero-tint", hexToRgba(color, 0.14));

    const close = el("button", "detail-close");
    close.type = "button";
    close.title = "Cerrar ficha";
    close.setAttribute("aria-label", "Cerrar ficha");
    close.innerHTML = ICONS.close;
    close.addEventListener("click", () => {
      clearSelection();
      els.app.classList.remove("detail-open");
    });

    const avatar = el("div", "hero-avatar");
    paintAvatar(avatar, person);

    const chip = groupChip(group);

    const name = el("h1", null, person.name);
    const relations = relationsOf(person.id);
    const sub = el("p", "hero-sub");
    sub.append(document.createTextNode(plural(relations.length, "vínculo", "vínculos")));
    if (group) {
      const sep = el("span", "sep", "·");
      sub.append(sep, document.createTextNode(group.name));
    }

    const focus = el("button", "hero-tree-btn");
    focus.type = "button";
    const isCurrentRoot = ui.focusRootId === person.id;
    focus.innerHTML = ICONS.tree + `<span>${isCurrentRoot ? "Vista general" : "Ver su árbol"}</span>`;
    focus.title = isCurrentRoot ? "Volver a la vista general" : `Ver el árbol de ${person.name}`;
    focus.addEventListener("click", () => {
      if (isCurrentRoot) exitFocusTree();
      else openFocusTree(person.id);
    });

    hero.append(close, avatar, chip, name, sub, focus);
    return hero;
  }

  function buildContactsSection(person) {
    const section = el("div", "detail-section contacts-section");
    const head = el("div", "detail-section-head");
    const entries = socialEntries(person);
    head.appendChild(el("h2", null, `Contactos y conocidos · ${entries.length}`));
    section.appendChild(head);

    if (!entries.length) {
      section.appendChild(
        el(
          "div",
          "description-box empty",
          "No tiene contactos o conocidos registrados. Añade una amistad o un trato ocasional para completar su red social."
        )
      );
      const create = el("button", "text-btn");
      create.type = "button";
      create.style.marginTop = "8px";
      create.innerHTML = ICONS.plus + "<span>Añadir un contacto</span>";
      create.addEventListener("click", () => startConnect(person.id));
      section.appendChild(create);
      return section;
    }

    const list = el("div", "contact-chips");
    entries.forEach(({ relation, other }) => {
      const chip = el("button", "contact-chip");
      const label = relationDisplayLabel(relation);
      chip.type = "button";
      chip.title = `Abrir la ficha de ${other.name} · ${label}`;
      const avatar = el("span", "mini-avatar contact-chip-avatar");
      paintAvatar(avatar, other);
      const copy = el("span", "contact-chip-copy");
      copy.appendChild(el("span", "contact-chip-name", other.name));
      copy.appendChild(el("span", "contact-chip-type", label));
      chip.append(avatar, copy);
      chip.addEventListener("click", () => {
        hideContactCard();
        if (!visiblePersonIds().has(other.id)) {
          openFocusTree(other.id);
          return;
        }
        selectPerson(other.id);
        focusPerson(other.id);
      });
      list.appendChild(chip);
    });
    section.appendChild(list);
    section.appendChild(
      el(
        "p",
        "relation-note",
        "Los contactos sociales no forman parte del árbol familiar. Pasa el cursor sobre una tarjeta del lienzo para verlos al instante."
      )
    );
    return section;
  }

  function buildRelationsSection(person, { includeSocial = true } = {}) {
    const section = el("div", "detail-section");
    const head = el("div", "detail-section-head");
    const allRelations = relationsOf(person.id);
    const relations = includeSocial
      ? allRelations
      : allRelations.filter((relation) => isFamilyRelation(relation));
    head.appendChild(
      el("h2", null, includeSocial ? `Vínculos · ${relations.length}` : `Vínculos familiares · ${relations.length}`)
    );
    section.appendChild(head);

    if (!relations.length) {
      const box = el(
        "div",
        "description-box empty",
        !includeSocial && allRelations.length
          ? "Sin vínculos familiares. Sus contactos y conocidos aparecen en la sección superior."
          : "Este personaje todavía no tiene vínculos. Conéctalo con alguien para empezar a tejer su historia."
      );
      section.appendChild(box);
      const create = el("button", "text-btn");
      create.type = "button";
      create.style.marginTop = "8px";
      create.innerHTML = ICONS.plus + "<span>Crear el primer vínculo</span>";
      create.addEventListener("click", () => startConnect(person.id));
      section.appendChild(create);
      return section;
    }

    const groups = [
      { label: includeSocial ? "Familia" : "Vínculos familiares", items: [] },
      { label: "Vínculos sociales", items: [] },
    ];

    const entries = relations
      .map((relation) => {
        const otherId = relation.from === person.id ? relation.to : relation.from;
        const other = personById(otherId);
        return other ? { relation, other, config: REL_BY_ID[relation.type] } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.config.width - a.config.width || a.other.name.localeCompare(b.other.name, "es"));

    entries.forEach((entry) => {
      if (isFamilyRelation(entry.relation)) groups[0].items.push(entry);
      else if (includeSocial) groups[1].items.push(entry);
    });

    groups.forEach((group) => {
      if (!group.items.length) return;
      group.items.forEach(({ relation, other, config }, index) => {
        if (index === 0) section.appendChild(el("p", "rel-group-label", group.label));

        const row = el("div", "rel-row");
        const main = el("button", "rel-main");
        main.type = "button";
        const wrap = el("div", "rel-line-wrap");
        const line = el("span", "rel-line");
        const familyLink = isFamilyRelation(relation);
        line.style.height = `${familyLink ? config.width : Math.max(2, config.width)}px`;
        line.style.background = familyLink
          ? config.color
          : `repeating-linear-gradient(90deg, ${config.color} 0 5px, transparent 5px 8px)`;
        wrap.appendChild(line);

        const label = relationDisplayLabel(relation);
        const copy = el("span", "rel-copy");
        copy.appendChild(el("span", "rel-name", other.name));
        copy.appendChild(el("span", "rel-type", label));

        const chevron = el("span", "rel-chevron");
        chevron.innerHTML = ICONS.chevron;

        main.append(wrap, copy, chevron);
        main.title = `Abrir la ficha de ${other.name}`;
        main.addEventListener("click", () => {
          if (!visiblePersonIds().has(other.id)) {
            openFocusTree(other.id);
            return;
          }
          selectPerson(other.id);
          focusPerson(other.id);
        });

        const tree = el("button", "rel-icon-btn");
        tree.type = "button";
        tree.title = `Ver el árbol de ${other.name}`;
        tree.setAttribute("aria-label", `Ver el árbol de ${other.name}`);
        tree.innerHTML = ICONS.tree;
        tree.addEventListener("click", () => openFocusTree(other.id));

        const edit = el("button", "rel-icon-btn");
        edit.type = "button";
        edit.title = `Editar ${label.toLowerCase()} con ${other.name}`;
        edit.setAttribute("aria-label", `Editar vínculo con ${other.name}`);
        edit.innerHTML = ICONS.edit;
        edit.addEventListener("click", () => openRelationDialog(relation.id));

        row.append(main, tree, edit);
        section.appendChild(row);
      });
    });

    if (groups[1].items.length) {
      const note = el(
        "p",
        "relation-note",
        "Los vínculos sociales no forman parte del árbol familiar. Pulsa el icono de árbol para explorar la red propia de esa persona."
      );
      section.appendChild(note);
    }

    return section;
  }

  function renderDetail() {
    els.detail.innerHTML = "";
    const person = personById(ui.selectedId);
    const active = activeGroup();
    if (!person || !active || person.groupId !== active.id) {
      els.detail.appendChild(buildDetailPlaceholder());
      return;
    }

    const scroll = el("div", "detail-scroll");
    const hero = buildHero(person);

    const body = el("div", "detail-body");

    const description = el("div", "detail-section");
    const descHead = el("div", "detail-section-head");
    descHead.appendChild(el("h2", null, "Descripción"));
    const editDescription = el("button", "text-btn");
    editDescription.type = "button";
    editDescription.innerHTML = ICONS.edit + "<span>Editar</span>";
    editDescription.addEventListener("click", () => openPersonDialog(person.id));
    descHead.appendChild(editDescription);
    description.appendChild(descHead);
    const descBox = el("div", "description-box" + (person.description ? "" : " empty"));
    descBox.textContent = person.description || "Sin descripción todavía. Añade su historia, personalidad o secretos.";
    description.appendChild(descBox);

    const familyMode = ui.viewMode === "family";
    body.appendChild(description);
    if (familyMode) body.appendChild(buildContactsSection(person));
    body.appendChild(buildRelationsSection(person, { includeSocial: !familyMode }));

    scroll.append(hero, body);

    const actions = el("div", "detail-actions");
    const connect = el("button", "btn btn-primary grow");
    connect.type = "button";
    connect.innerHTML = ICONS.link + "<span>Vincular</span>";
    connect.addEventListener("click", () => startConnect(person.id));

    const edit = el("button", "btn btn-icon");
    edit.type = "button";
    edit.title = "Editar personaje";
    edit.setAttribute("aria-label", "Editar personaje");
    edit.innerHTML = ICONS.edit;
    edit.addEventListener("click", () => openPersonDialog(person.id));

    const remove = el("button", "btn btn-icon btn-danger-ghost");
    remove.type = "button";
    remove.title = "Eliminar personaje";
    remove.setAttribute("aria-label", "Eliminar personaje");
    remove.innerHTML = ICONS.trash;
    remove.addEventListener("click", () => confirmDeletePerson(person.id));

    actions.append(connect, edit, remove);
    els.detail.append(scroll, actions);
    scroll.scrollTop = 0;
  }

  /* ---------------- Lienzo: nodos y líneas ---------------- */
  function renderNodes() {
    els.nodeLayer.innerHTML = "";

    visiblePeople().forEach((person) => {
      const color = colorOf(person);
      const relations = relationsOf(person.id);
      const familyCount = relations.filter(isFamilyRelation).length;
      const socialCount = relations.filter(isSocialRelation).length;
      const group = groupById(person.groupId);
      const node = document.createElement("article");
      node.className = "node";
      node.dataset.id = person.id;
      node.tabIndex = 0;
      node.setAttribute("role", "button");
      node.title = `${person.name} · ${plural(relations.length, "vínculo", "vínculos")}`;
      node.style.transform = `translate3d(${person.x}px, ${person.y}px, 0)`;
      node.style.setProperty("--node-color", color);
      node.style.setProperty("--node-glow", hexToRgba(color, 0.18));
      if (ui.selectedId === person.id) node.classList.add("is-selected");
      if (ui.focusRootId === person.id) node.classList.add("is-root");
      if (ui.connect.active && ui.connect.fromId === person.id) node.classList.add("connect-source");
      if (!familyCount && socialCount) node.classList.add("is-social-only");

      const card = el("div", "node-card");
      const avatar = el("div", "node-avatar");
      avatar.setAttribute("aria-hidden", "true");
      paintAvatar(avatar, person);

      const copy = el("div", "node-copy");
      copy.appendChild(el("div", "node-name", person.name));
      const meta = el("div", "node-meta");
      meta.setAttribute("aria-hidden", "true");
      const dot = el("span", "node-meta-dot");
      meta.append(dot, el("span", null, group ? group.name : "Sin grupo"));
      copy.appendChild(meta);

      card.append(avatar, copy);
      node.appendChild(card);

      if (socialCount) {
        const badge = el("span", "node-social-badge");
        badge.title = plural(socialCount, "vínculo social", "vínculos sociales");
        badge.setAttribute("aria-hidden", "true");
        badge.innerHTML = `${ICONS.users}<span>${socialCount}</span>`;
        node.appendChild(badge);
      }

      if (ui.focusRootId === person.id) {
        const rootMark = el("span", "node-root-mark");
        rootMark.title = "Raíz del árbol";
        rootMark.innerHTML = ICONS.tree;
        node.appendChild(rootMark);
      }

      node.addEventListener("pointerenter", (event) => {
        if (event.pointerType && event.pointerType !== "mouse") return;
        scheduleContactCard(person, node);
      });
      node.addEventListener("pointerleave", () => hideContactCardSoon());
      node.addEventListener("focus", () => scheduleContactCard(person, node));
      node.addEventListener("blur", () => hideContactCardSoon());

      node.addEventListener("click", (event) => {
        event.stopPropagation();
        if (performance.now() < ui.suppressClickUntil) return;
        hideContactCard();
        handleNodeActivate(person.id);
      });

      node.addEventListener("pointerdown", (event) => startNodeDrag(event, person, node));

      node.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleNodeActivate(person.id);
        }
      });

      els.nodeLayer.appendChild(node);
    });

    if (!ui.selectedId && !ui.focusRootId && ui.viewMode === "all") {
      const visible = visiblePeople();
      const known = visible.filter(
        (person) => !relationsOf(person.id).some((relation) => isFamilyRelation(relation))
      );
      if (known.length && known.length < visible.length) {
        const minX = Math.min(...known.map((person) => person.x));
        const minY = Math.min(...known.map((person) => person.y));
        const caption = el("div", "canvas-caption");
        caption.style.transform = `translate3d(${Math.round(minX - 2)}px, ${Math.round(minY - 38)}px, 0)`;
        caption.append(
          el("span", "canvas-caption-dot"),
          el("span", null, `Conocidos · ${known.length}`)
        );
        els.nodeLayer.appendChild(caption);
      }
    }
  }

  function contactCardAllowed(person) {
    if (!person || ui.viewMode !== "family" || ui.connect.active) return false;
    if (document.querySelector("dialog[open]")) return false;
    const group = activeGroup();
    if (!group || person.groupId !== group.id) return false;
    return socialEntries(person).length > 0;
  }

  function ensureContactCard() {
    if (ui.hoverCard && ui.hoverCard.isConnected) return ui.hoverCard;
    const card = el("div", "contact-card");
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-label", "Contactos y conocidos");
    card.hidden = true;
    card.addEventListener("pointerenter", () => {
      if (ui.hoverTimer) {
        window.clearTimeout(ui.hoverTimer);
        ui.hoverTimer = null;
      }
    });
    card.addEventListener("pointerleave", () => hideContactCardSoon());
    card.addEventListener("keydown", (event) => {
      if (event.key === "Escape") hideContactCard();
    });
    document.body.appendChild(card);
    ui.hoverCard = card;
    return card;
  }

  function positionContactCard(card, node) {
    const rect = node.getBoundingClientRect();
    const margin = 12;
    card.style.visibility = "hidden";
    card.hidden = false;
    const box = card.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = rect.right + margin;
    if (left + box.width > vw - margin) left = rect.left - box.width - margin;
    if (left < margin) left = Math.min(Math.max(margin, rect.left), vw - box.width - margin);

    let top = rect.top + rect.height / 2 - box.height / 2;
    top = Math.max(margin, Math.min(top, vh - box.height - margin));

    card.style.left = `${Math.round(left)}px`;
    card.style.top = `${Math.round(top)}px`;
    card.style.visibility = "visible";
  }

  function renderContactCard(person, node) {
    const card = ensureContactCard();
    const entries = socialEntries(person);
    card.innerHTML = "";

    const head = el("div", "contact-card-head");
    head.appendChild(el("span", "contact-card-eyebrow", "Contactos y conocidos"));
    head.appendChild(el("strong", "contact-card-title", person.name));
    head.appendChild(
      el("span", "contact-card-sub", plural(entries.length, "contacto social", "contactos sociales"))
    );
    card.appendChild(head);

    const list = el("div", "contact-card-list");
    entries.slice(0, 8).forEach(({ relation, other, config }) => {
      const row = el("button", "contact-card-row");
      row.type = "button";
      row.title = `Abrir la ficha de ${other.name}`;
      const avatar = el("span", "mini-avatar contact-card-avatar");
      paintAvatar(avatar, other);
      const copy = el("span", "contact-card-copy");
      copy.appendChild(el("span", "contact-card-name", other.name));
      copy.appendChild(el("span", "contact-card-type", relationDisplayLabel(relation)));
      row.append(avatar, copy);
      row.addEventListener("click", () => {
        hideContactCard({ restoreFocus: false });
        if (!visiblePersonIds().has(other.id)) {
          openFocusTree(other.id);
          return;
        }
        selectPerson(other.id);
        focusPerson(other.id);
      });
      list.appendChild(row);
    });
    card.appendChild(list);

    if (entries.length > 8) {
      card.appendChild(
        el("p", "contact-card-more", `y ${entries.length - 8} más en su ficha`)
      );
    }

    card.appendChild(
      el("p", "contact-card-hint", "Haz clic en una tarjeta para ver todos sus contactos.")
    );

    ui.hoverNode = node;
    positionContactCard(card, node);
  }

  function scheduleContactCard(person, node) {
    if (ui.hoverTimer) window.clearTimeout(ui.hoverTimer);
    if (!contactCardAllowed(person)) {
      hideContactCard();
      return;
    }
    ui.hoverPersonId = person.id;
    ui.hoverTimer = window.setTimeout(() => {
      ui.hoverTimer = null;
      if (!node.isConnected) return;
      const current = personById(person.id);
      if (!current || !contactCardAllowed(current)) return;
      renderContactCard(current, node);
    }, 260);
  }

  function hideContactCardSoon() {
    if (ui.hoverTimer) {
      window.clearTimeout(ui.hoverTimer);
      ui.hoverTimer = null;
    }
    if (!ui.hoverCard) return;
    ui.hoverTimer = window.setTimeout(() => {
      ui.hoverTimer = null;
      if (ui.hoverCard && ui.hoverCard.contains(document.activeElement)) return;
      hideContactCard();
    }, 140);
  }

  function hideContactCard({ restoreFocus = true } = {}) {
    if (ui.hoverTimer) {
      window.clearTimeout(ui.hoverTimer);
      ui.hoverTimer = null;
    }
    ui.hoverPersonId = null;
    if (!ui.hoverCard) return;
    const card = ui.hoverCard;
    const node = ui.hoverNode;
    const hadFocus = card.contains(document.activeElement);
    card.hidden = true;
    card.innerHTML = "";
    ui.hoverNode = null;
    if (restoreFocus && hadFocus && node && node.isConnected) node.focus();
  }

  function startNodeDrag(event, person, node) {
    if (event.button !== 0) return;
    event.stopPropagation();
    if (ui.connect.active) return;
    event.preventDefault();
    cancelViewAnim();

    const startClient = { x: event.clientX, y: event.clientY };
    const startPos = { x: person.x, y: person.y };
    let moved = false;

    const onMove = (moveEvent) => {
      const dx = (moveEvent.clientX - startClient.x) / view.k;
      const dy = (moveEvent.clientY - startClient.y) / view.k;
      if (!moved && Math.hypot(dx, dy) > 4) {
        moved = true;
        hideContactCard();
        if (ui.radial) ui.radial = null;
        node.classList.add("dragging");
      }
      if (!moved) return;
      person.x = clamp(startPos.x + dx, 24, WORLD_W - NODE_W - 24);
      person.y = clamp(startPos.y + dy, 24, WORLD_H - NODE_H - 24);
      node.style.transform = `translate3d(${person.x}px, ${person.y}px, 0)`;
      renderEdges();
    };

    const onEnd = () => {
      node.removeEventListener("pointermove", onMove);
      node.removeEventListener("pointerup", onEnd);
      node.removeEventListener("pointercancel", onEnd);
      node.classList.remove("dragging");
      if (moved) {
        ui.suppressClickUntil = performance.now() + 220;
        scheduleSave();
      }
    };

    try {
      node.setPointerCapture(event.pointerId);
    } catch {
      /* sin captura, el arrastre sigue funcionando dentro del nodo */
    }
    node.addEventListener("pointermove", onMove);
    node.addEventListener("pointerup", onEnd);
    node.addEventListener("pointercancel", onEnd);
  }

  function handleNodeActivate(personId) {
    if (ui.connect.active) {
      if (!ui.connect.fromId) {
        ui.connect.fromId = personId;
        updateConnectUI();
        return;
      }
      if (ui.connect.fromId === personId) {
        toast("Elige una persona distinta para crear el vínculo.", "error");
        return;
      }
      openRelationDialog(null, ui.connect.fromId, personId);
      return;
    }

    selectPerson(personId);
    if (isNarrow()) els.app.classList.add("detail-open");
  }

  function nodeRect(person) {
    return {
      left: person.x,
      right: person.x + NODE_W,
      top: person.y,
      bottom: person.y + NODE_H,
      cx: person.x + NODE_W / 2,
      cy: person.y + NODE_H / 2,
    };
  }

  function boundaryPoint(person, targetX, targetY) {
    const cx = person.x + NODE_W / 2;
    const cy = person.y + NODE_H / 2;
    const dx = targetX - cx;
    const dy = targetY - cy;
    if (!dx && !dy) return { x: cx, y: cy };
    const t = Math.min(
      (NODE_W / 2 + 3) / (Math.abs(dx) || 1e-9),
      (NODE_H / 2 + 3) / (Math.abs(dy) || 1e-9)
    );
    return { x: cx + dx * t, y: cy + dy * t };
  }

  function parentChildPair(relation) {
    if (!relation || relation.type !== "hijo") return null;
    const a = personById(relation.from);
    const b = personById(relation.to);
    if (!a || !b) return null;
    const ra = nodeRect(a);
    const rb = nodeRect(b);
    if (ra.cy < rb.cy - 8) return { parent: a, child: b };
    if (rb.cy < ra.cy - 8) return { parent: b, child: a };
    return { parent: a, child: b };
  }

  function coupleGeometry(a, b) {
    const ra = nodeRect(a);
    const rb = nodeRect(b);
    if (Math.abs(ra.cy - rb.cy) <= NODE_H * 0.62) {
      const left = ra.cx <= rb.cx ? ra : rb;
      const right = ra.cx <= rb.cx ? rb : ra;
      const y = (left.cy + right.cy) / 2;
      if (left.right <= right.left + 3) {
        return {
          d: `M ${left.right.toFixed(2)} ${y.toFixed(2)} L ${right.left.toFixed(2)} ${y.toFixed(2)}`,
          center: { x: (left.right + right.left) / 2, y },
          horizontal: true,
        };
      }
    }
    const top = ra.cy <= rb.cy ? ra : rb;
    const bottom = ra.cy <= rb.cy ? rb : ra;
    const x = (ra.cx + rb.cx) / 2;
    return {
      d: `M ${x.toFixed(2)} ${top.bottom.toFixed(2)} L ${x.toFixed(2)} ${bottom.top.toFixed(2)}`,
      center: { x, y: (top.bottom + bottom.top) / 2 },
      horizontal: false,
    };
  }

  function curveGeometry(a, b, bend = 0.16, seed = 0) {
    const ac = { x: a.x + NODE_W / 2, y: a.y + NODE_H / 2 };
    const bc = { x: b.x + NODE_W / 2, y: b.y + NODE_H / 2 };
    const p1 = boundaryPoint(a, bc.x, bc.y);
    const p2 = boundaryPoint(b, ac.x, ac.y);
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const length = Math.hypot(dx, dy) || 1;
    const direction = seed % 2 === 0 ? 1 : -1;
    const offset = Math.min(72, Math.max(16, length * bend)) * direction;
    const mx = (p1.x + p2.x) / 2 - (dy / length) * offset;
    const my = (p1.y + p2.y) / 2 + (dx / length) * offset;
    return {
      d: `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} Q ${mx.toFixed(2)} ${my.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
      label: { x: mx, y: my },
    };
  }

  function branchGroups(relations) {
    const byChild = new Map();
    relations.forEach((relation) => {
      if (relation.type !== "hijo") return;
      const pair = parentChildPair(relation);
      if (!pair) return;
      if (!byChild.has(pair.child.id)) {
        byChild.set(pair.child.id, { child: pair.child, parents: new Set(), relations: [] });
      }
      const entry = byChild.get(pair.child.id);
      entry.parents.add(pair.parent.id);
      entry.relations.push(relation);
    });

    const groups = new Map();
    byChild.forEach((entry) => {
      const parentIds = [...entry.parents].sort();
      const key = parentIds.join("|");
      if (!groups.has(key)) {
        groups.set(key, { parentIds, parents: [], children: [], relations: [] });
      }
      const group = groups.get(key);
      group.children.push({ person: entry.child, relationIds: entry.relations.map((r) => r.id) });
      group.relations.push(...entry.relations);
    });

    groups.forEach((group) => {
      group.parents = group.parentIds.map(personById).filter(Boolean);
    });
    return [...groups.values()].filter((group) => group.parents.length && group.children.length);
  }

  function branchGeometry(group) {
    const parentRects = group.parents.map(nodeRect);
    const children = group.children
      .map((entry) => ({ entry, rect: nodeRect(entry.person) }))
      .sort((a, b) => a.rect.cx - b.rect.cx);
    const childXs = children.map((item) => item.rect.cx);
    const childTop = Math.min(...children.map((item) => item.rect.top));
    const childBottom = Math.max(...children.map((item) => item.rect.bottom));
    const parentTop = Math.min(...parentRects.map((rect) => rect.top));
    const parentBottom = Math.max(...parentRects.map((rect) => rect.bottom));

    let anchor = {
      x: parentRects.reduce((sum, rect) => sum + rect.cx, 0) / parentRects.length,
      y: parentBottom,
    };

    if (group.parents.length === 2 && findRelationBetween(group.parents[0].id, group.parents[1].id)?.type === "pareja") {
      const union = coupleGeometry(group.parents[0], group.parents[1]);
      anchor = { ...union.center };
    }

    const segments = [];
    let label = { x: anchor.x, y: anchor.y + 30 };

    if (childTop > anchor.y + 18) {
      const busY = Math.max(anchor.y + 28, childTop - Math.min(56, Math.max(32, (childTop - anchor.y) * 0.3)));
      const minX = Math.min(anchor.x, ...childXs);
      const maxX = Math.max(anchor.x, ...childXs);
      segments.push(`M ${anchor.x.toFixed(2)} ${anchor.y.toFixed(2)} L ${anchor.x.toFixed(2)} ${busY.toFixed(2)}`);
      segments.push(`M ${minX.toFixed(2)} ${busY.toFixed(2)} L ${maxX.toFixed(2)} ${busY.toFixed(2)}`);
      children.forEach((item) => {
        segments.push(`M ${item.rect.cx.toFixed(2)} ${busY.toFixed(2)} L ${item.rect.cx.toFixed(2)} ${item.rect.top.toFixed(2)}`);
      });
      label = { x: (minX + maxX) / 2, y: busY };
    } else if (childBottom < anchor.y - 18) {
      const busY = Math.min(anchor.y - 28, childBottom + Math.min(56, Math.max(32, (anchor.y - childBottom) * 0.3)));
      const minX = Math.min(anchor.x, ...childXs);
      const maxX = Math.max(anchor.x, ...childXs);
      segments.push(`M ${anchor.x.toFixed(2)} ${anchor.y.toFixed(2)} L ${anchor.x.toFixed(2)} ${busY.toFixed(2)}`);
      segments.push(`M ${minX.toFixed(2)} ${busY.toFixed(2)} L ${maxX.toFixed(2)} ${busY.toFixed(2)}`);
      children.forEach((item) => {
        segments.push(`M ${item.rect.cx.toFixed(2)} ${busY.toFixed(2)} L ${item.rect.cx.toFixed(2)} ${item.rect.bottom.toFixed(2)}`);
      });
      label = { x: (minX + maxX) / 2, y: busY };
    } else {
      children.forEach((item) => {
        const target = item.rect.cx >= anchor.x ? item.rect.left : item.rect.right;
        const midX = (anchor.x + target) / 2;
        segments.push(`M ${anchor.x.toFixed(2)} ${anchor.y.toFixed(2)} L ${midX.toFixed(2)} ${anchor.y.toFixed(2)} L ${midX.toFixed(2)} ${item.rect.cy.toFixed(2)} L ${target.toFixed(2)} ${item.rect.cy.toFixed(2)}`);
      });
      label = { x: (anchor.x + (children[0]?.rect.cx || anchor.x)) / 2, y: anchor.y - 12 };
    }

    return {
      d: segments.join(" "),
      anchor,
      label,
      childTop,
      childBottom,
      parentTop,
    };
  }

  function makeEdgeTag(x, y, textContent) {
    const label = String(textContent || "");
    const width = Math.max(46, label.length * 6.2 + 16);
    const tag = svgEl("g", {
      class: "edge-tag",
      transform: `translate(${x.toFixed(2)}, ${y.toFixed(2)})`,
    });
    tag.appendChild(
      svgEl("rect", {
        x: (-width / 2).toFixed(2),
        y: "-22",
        width: width.toFixed(2),
        height: "17",
        rx: "5",
        ry: "5",
      })
    );
    const text = svgEl("text", { x: "0", y: "-10", "text-anchor": "middle" });
    text.textContent = label;
    tag.appendChild(text);
    return tag;
  }

  function drawEdge({ relation, relationIds, a, b, config, d, labelPoint, labelText, dimmed, selected, socialStyle, titleText, onActivate }) {
    const group = svgEl("g", {
      class: `edge edge-${relation ? relation.type : "branch"}${dimmed ? " is-dimmed" : ""}${selected ? " is-selected" : ""}`,
    });
    const title = svgEl("title");
    title.textContent = titleText;
    group.appendChild(title);

    const hit = svgEl("path", {
      class: "edge-hit",
      d,
      "stroke-width": Math.max(22, config.width + 16).toFixed(1),
    });
    hit.addEventListener("pointerdown", (event) => event.stopPropagation());
    hit.addEventListener("click", (event) => {
      event.stopPropagation();
      if (onActivate) onActivate(event);
      else if (relation) openRelationDialog(relation.id);
    });

    const line = svgEl("path", {
      class: "edge-line",
      d,
      stroke: config.color,
      "stroke-width": config.width.toFixed(2),
      opacity: "0.9",
    });
    if (socialStyle) {
      line.setAttribute("stroke-dasharray", socialStyle);
      line.setAttribute("stroke-linecap", "round");
    }

    group.append(hit, line);
    if (labelPoint && labelText) group.appendChild(makeEdgeTag(labelPoint.x, labelPoint.y, labelText));
    els.edgeLayer.appendChild(group);
    return group;
  }

  function renderEdges() {
    els.edgeLayer.innerHTML = "";

    const relations = visibleRelations();
    const groups = branchGroups(relations);

    relations.forEach((relation) => {
      if (relation.type === "hijo") return;
      const a = personById(relation.from);
      const b = personById(relation.to);
      const config = REL_BY_ID[relation.type];
      if (!a || !b || !config) return;

      const dimmed = false;
      const selected = ui.selectedRelationId === relation.id;
      let geometry;
      let socialStyle = null;
      let labelText = relation.label ? shortLabel(relation.label, 22) : config.short || config.label;

      if (relation.type === "pareja") {
        geometry = coupleGeometry(a, b);
        geometry.label = { x: geometry.center.x, y: geometry.center.y - 4 };
      } else if (relation.type === "sangre") {
        geometry = curveGeometry(a, b, 0.11, relation.id.length + relation.from.length);
      } else if (relation.type === "familia") {
        geometry = curveGeometry(a, b, 0.18, relation.id.length + relation.to.length);
        socialStyle = "9 7";
      } else if (relation.type === "amistad") {
        geometry = curveGeometry(a, b, 0.2, relation.id.length + relation.from.length);
        socialStyle = "1 8";
      } else {
        geometry = curveGeometry(a, b, 0.16, relation.id.length + relation.to.length);
        socialStyle = "5 7";
      }

      drawEdge({
        relation,
        relationIds: [relation.id],
        a,
        b,
        config,
        d: geometry.d,
        labelPoint: geometry.label,
        labelText,
        dimmed,
        selected,
        socialStyle,
        titleText: `${a.name} ↔ ${b.name}: ${relationDisplayLabel(relation)}`,
      });
    });

    groups.forEach((group) => {
      const geometry = branchGeometry(group);
      const config = REL_BY_ID.hijo;
      const parentNames = group.parents.map((person) => person.name).join(" y ");
      const dimmed = false;
      const selected = group.relations.some((relation) => relation.id === ui.selectedRelationId);
      const count = group.children.length;
      const groupLabel = count > 1 ? `Hijos/as · ${count}` : "Hijo/a";

      drawEdge({
        relation: null,
        relationIds: group.relations.map((relation) => relation.id),
        a: group.parents[0],
        b: group.children[0].person,
        config,
        d: geometry.d,
        labelPoint: geometry.label,
        labelText: groupLabel,
        dimmed,
        selected,
        socialStyle: null,
        titleText: `${parentNames} → ${group.children.map((item) => item.person.name).join(", ")}`,
        onActivate: (event) => {
          const point = screenToWorld(event.clientX, event.clientY);
          let closest = group.children[0].person;
          let bestDistance = Infinity;
          group.children.forEach((item) => {
            const rect = nodeRect(item.person);
            const distance = Math.hypot(rect.cx - point.x, rect.cy - point.y);
            if (distance < bestDistance) {
              bestDistance = distance;
              closest = item.person;
            }
          });
          selectPerson(closest.id);
          if (isNarrow()) els.app.classList.add("detail-open");
        },
      });
    });

    updatePendingLine();
  }

  function updatePendingLine() {
    const existing = els.edgeLayer.querySelector(".connect-line");
    const from = personById(ui.connect.fromId);
    if (!ui.connect.active || !from || !ui.connect.pointer) {
      if (existing) existing.remove();
      return;
    }
    let line = existing;
    if (!line) {
      line = svgEl("path", { class: "connect-line" });
      els.edgeLayer.appendChild(line);
    }
    const sx = from.x + NODE_W / 2;
    const sy = from.y + NODE_H / 2;
    line.setAttribute("d", `M ${sx} ${sy} L ${ui.connect.pointer.x} ${ui.connect.pointer.y}`);
  }

  function renderCanvas() {
    renderEdges();
    renderNodes();
  }

  /* ---------------- Vista, zoom y encuadre ---------------- */
  function applyView() {
    els.world.style.transform = `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.k})`;
    let step = 26 * view.k;
    while (step < 16) step *= 2;
    while (step > 96) step /= 2;
    els.viewport.style.backgroundSize = `${step.toFixed(2)}px ${step.toFixed(2)}px`;
    els.viewport.style.backgroundPosition = `${view.x}px ${view.y}px`;
    els.zoomPct.textContent = `${Math.round(view.k * 100)}%`;
  }

  function cancelViewAnim() {
    if (ui.viewAnim) {
      cancelAnimationFrame(ui.viewAnim);
      ui.viewAnim = null;
    }
  }

  function animateTo(target, duration = 320) {
    cancelViewAnim();
    const next = normalizeView(target);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || duration <= 0) {
      view = next;
      applyView();
      scheduleSave();
      return;
    }

    const start = { ...view };
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      view = {
        x: start.x + (next.x - start.x) * ease,
        y: start.y + (next.y - start.y) * ease,
        k: start.k + (next.k - start.k) * ease,
      };
      applyView();
      if (t < 1) {
        ui.viewAnim = requestAnimationFrame(step);
      } else {
        ui.viewAnim = null;
        view = next;
        applyView();
        scheduleSave();
      }
    };
    ui.viewAnim = requestAnimationFrame(step);
  }

  function viewportRect() {
    return els.viewport.getBoundingClientRect();
  }

  function screenToWorld(clientX, clientY) {
    const rect = viewportRect();
    return {
      x: (clientX - rect.left - view.x) / view.k,
      y: (clientY - rect.top - view.y) / view.k,
    };
  }

  function fitView(animate = true) {
    const rect = viewportRect();
    if (!rect.width || !rect.height) return;

    if (!data.people.length) {
      if (animate) animateTo({ x: 0, y: 0, k: 1 }, 260);
      else {
        view = { x: 0, y: 0, k: 1 };
        applyView();
        scheduleSave();
      }
      return;
    }

    const people = visiblePeople();
    if (!people.length) {
      if (animate) animateTo({ x: 0, y: 0, k: 1 }, 260);
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    people.forEach((person) => {
      minX = Math.min(minX, person.x);
      minY = Math.min(minY, person.y);
      maxX = Math.max(maxX, person.x + NODE_W);
      maxY = Math.max(maxY, person.y + NODE_H);
    });

    const padX = isNarrow() ? 26 : 56;
    const padTop = focusedPerson() ? 116 : (isNarrow() ? 78 : 92);
    const padBottom = 52;
    const bw = Math.max(1, maxX - minX);
    const bh = Math.max(1, maxY - minY);
    const availW = Math.max(60, rect.width - padX * 2);
    const availH = Math.max(60, rect.height - padTop - padBottom);
    const k = clamp(
      Math.min(availW / bw, availH / bh),
      MIN_ZOOM,
      1.15
    );
    const target = {
      k,
      x: padX + (availW - bw * k) / 2 - minX * k,
      y: padTop + (availH - bh * k) / 2 - minY * k,
    };

    if (animate) animateTo(target, 360);
    else {
      view = normalizeView(target);
      applyView();
      scheduleSave();
    }
  }

  function focusPerson(personId) {
    const person = personById(personId);
    if (!person) return;
    const rect = viewportRect();
    if (!rect.width || !rect.height) return;
    const k = clamp(Math.max(view.k, 0.78), MIN_ZOOM, 1.2);
    animateTo({
      k,
      x: rect.width / 2 - (person.x + NODE_W / 2) * k,
      y: rect.height / 2 - (person.y + NODE_H / 2) * k,
    }, 320);
  }

  function zoomAt(mx, my, factor) {
    cancelViewAnim();
    const nextK = clamp(view.k * factor, MIN_ZOOM, MAX_ZOOM);
    if (Math.abs(nextK - view.k) < 0.0001) return;
    view.x = mx - (mx - view.x) * (nextK / view.k);
    view.y = my - (my - view.y) * (nextK / view.k);
    view.k = nextK;
    applyView();
    scheduleSave();
  }

  function zoomBy(factor) {
    const rect = viewportRect();
    zoomAt(rect.width / 2, rect.height / 2, factor);
  }

  /* ---------------- Vista familiar y paneles ---------------- */
  function updateViewChrome() {
    const hasFocus = !!focusedPerson();
    const familyActive = !hasFocus && ui.viewMode === "family";
    const allActive = !hasFocus && ui.viewMode === "all";
    if (els.familyViewBtn) {
      els.familyViewBtn.classList.toggle("active", familyActive);
      els.familyViewBtn.setAttribute("aria-pressed", String(familyActive));
      const hidden = hiddenSocialCount();
      els.familyViewBtn.title = hidden
        ? `Solo estructura familiar · ${plural(hidden, "contacto social oculto", "contactos sociales ocultos")}`
        : "Mostrar solo la estructura familiar";
    }
    if (els.allViewBtn) {
      els.allViewBtn.classList.toggle("active", allActive);
      els.allViewBtn.setAttribute("aria-pressed", String(allActive));
    }

    const root = focusedPerson();
    if (!root) {
      els.focusBar.classList.add("hidden");
      return;
    }

    const family = familyComponentIds(root.id);
    const socialMode = family.size <= 1;
    const directSocials = directSocialIds(root.id);
    const visibleCount = socialMode ? directSocials.size + 1 : family.size;
    els.focusBar.classList.remove("hidden");
    els.focusBar.classList.toggle("is-social", socialMode);
    els.focusTitle.textContent = socialMode ? `Red de ${root.name}` : `Árbol de ${root.name}`;
    els.focusMeta.textContent = socialMode
      ? `Sin vínculos familiares · ${plural(directSocials.size, "contacto directo", "contactos directos")}`
      : `${plural(visibleCount, "persona", "personas")} · ${plural(data.relations.filter((relation) => isFamilyRelation(relation) && (family.has(relation.from) && family.has(relation.to))).length, "vínculo familiar", "vínculos familiares")}`;
  }

  function setViewMode(mode) {
    ui.viewMode = mode === "all" ? "all" : "family";
    ui.focusRootId = null;
    if (ui.selectedId) applyRadialLayout(ui.selectedId);
    renderAll();
    window.requestAnimationFrame(() => fitView(true));
  }

  function openFocusTree(personId) {
    const person = personById(personId);
    if (!person) return;
    restoreRadialPositions();
    ui.focusRootId = person.id;
    ui.selectedId = person.id;
    ui.connect.active = false;
    ui.connect.fromId = null;
    if (isNarrow()) els.app.classList.remove("left-open", "detail-open");
    renderAll();
    window.requestAnimationFrame(() => fitView(true));
    const socialMode = familyComponentIds(person.id).size <= 1;
    toast(
      socialMode
        ? `${person.name} aún no tiene vínculos familiares. Se muestran sus contactos directos.`
        : `Mostrando el árbol familiar de ${person.name}.`,
      socialMode ? "info" : "success"
    );
  }

  function exitFocusTree() {
    if (!ui.focusRootId) return;
    ui.focusRootId = null;
    renderAll();
    window.requestAnimationFrame(() => fitView(true));
  }

  function readThemeMode() {
    try {
      const saved = readStored(THEME_KEY, LEGACY_KEYS.theme);
      return saved === "light" || saved === "dark" ? saved : "auto";
    } catch {
      return "auto";
    }
  }

  function resolvedTheme() {
    if (themeMode === "light" || themeMode === "dark") return themeMode;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function applyTheme() {
    const resolved = resolvedTheme();
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
    if (!els.themeBtn) return;
    const labels = { auto: "automático", light: "claro", dark: "oscuro" };
    els.themeBtn.innerHTML = themeMode === "auto" ? ICONS.auto : themeMode === "light" ? ICONS.sun : ICONS.moon;
    els.themeBtn.title = `Tema: ${labels[themeMode]} · Clic para cambiar`;
    els.themeBtn.setAttribute("aria-label", `Tema ${labels[themeMode]}. Cambiar tema`);
    els.themeBtn.dataset.mode = themeMode;
  }

  function cycleTheme() {
    themeMode = themeMode === "auto" ? "light" : themeMode === "light" ? "dark" : "auto";
    try {
      window.localStorage.setItem(THEME_KEY, themeMode);
    } catch {
      /* el tema sigue funcionando durante la sesión */
    }
    applyTheme();
  }

  function panelState() {
    return {
      leftCollapsed: els.app.classList.contains("left-collapsed"),
      detailCollapsed: els.app.classList.contains("detail-collapsed"),
    };
  }

  function savePanelState() {
    try {
      window.localStorage.setItem(PANEL_KEY, JSON.stringify(panelState()));
    } catch {
      /* sin persistencia */
    }
  }

  function fitAfterPanelChange() {
    window.setTimeout(() => fitView(true), 280);
  }

  function updatePanelChrome() {
    const compact = isNarrow();
    const leftOpen = compact
      ? els.app.classList.contains("left-open")
      : !els.app.classList.contains("left-collapsed");
    const detailOpen = compact
      ? els.app.classList.contains("detail-open")
      : !els.app.classList.contains("detail-collapsed");
    els.menuBtn.setAttribute("aria-expanded", String(leftOpen));
    els.menuBtn.title = leftOpen ? "Ocultar grupos y personajes" : "Mostrar grupos y personajes";
    els.detailToggleBtn.setAttribute("aria-pressed", String(detailOpen));
    els.detailToggleBtn.title = detailOpen ? "Ocultar la ficha lateral" : "Mostrar la ficha lateral";
    els.detailToggleBtn.setAttribute("aria-label", detailOpen ? "Ocultar la ficha lateral" : "Mostrar la ficha lateral");
  }

  function toggleLeftPanel() {
    hideContactCard();
    if (isNarrow()) {
      els.app.classList.toggle("left-open");
      els.app.classList.remove("detail-open");
    } else {
      els.app.classList.toggle("left-collapsed");
      savePanelState();
      fitAfterPanelChange();
    }
    updatePanelChrome();
  }

  function toggleDetailPanel() {
    hideContactCard();
    if (isNarrow()) {
      els.app.classList.toggle("detail-open");
      els.app.classList.remove("left-open");
    } else {
      els.app.classList.toggle("detail-collapsed");
      savePanelState();
      fitAfterPanelChange();
    }
    updatePanelChrome();
  }

  function loadPanelState() {
    try {
      const raw = JSON.parse(readStored(PANEL_KEY, LEGACY_KEYS.panels) || "null");
      if (!raw || typeof raw !== "object") return;
      if (!isNarrow()) {
        els.app.classList.toggle("left-collapsed", !!raw.leftCollapsed);
        els.app.classList.toggle("detail-collapsed", !!raw.detailCollapsed);
      }
    } catch {
      /* sin estado de paneles */
    }
  }

  /* ---------------- Organización automática ---------------- */
  function organizeTree(silent = false) {
    if (ui.radial) restoreRadialPositions();
    const people = visiblePeople();
    if (!people.length) return;
    const relations = visibleRelations();
    const personIds = new Set(people.map((person) => person.id));
    const familyRelations = relations.filter((relation) => isFamilyRelation(relation) && personIds.has(relation.from) && personIds.has(relation.to));
    const familyIds = new Set();
    familyRelations.forEach((relation) => {
      familyIds.add(relation.from);
      familyIds.add(relation.to);
    });
    const familyPeople = people.filter((person) => familyIds.has(person.id));
    const knownPeople = people.filter((person) => !familyIds.has(person.id));

    const parent = new Map(people.map((person) => [person.id, person.id]));
    const find = (id) => {
      let root = id;
      while (parent.get(root) !== root) root = parent.get(root);
      while (parent.get(id) !== id) {
        const next = parent.get(id);
        parent.set(id, root);
        id = next;
      }
      return root;
    };
    const union = (a, b) => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent.set(rb, ra);
    };

    familyRelations.filter((relation) => relation.type === "pareja").forEach((relation) => union(relation.from, relation.to));

    const parentEdges = [];
    familyRelations.filter((relation) => relation.type === "hijo").forEach((relation) => {
      const pair = parentChildPair(relation);
      if (!pair || !personIds.has(pair.parent.id) || !personIds.has(pair.child.id)) return;
      const p = find(pair.parent.id);
      const c = find(pair.child.id);
      if (p !== c) parentEdges.push([p, c]);
    });

    const level = new Map();
    familyPeople.forEach((person) => level.set(find(person.id), 0));
    for (let pass = 0; pass < people.length + 2; pass += 1) {
      let changed = false;
      parentEdges.forEach(([p, c]) => {
        const next = (level.get(p) || 0) + 1;
        if (next > (level.get(c) || 0) && next < people.length + 2) {
          level.set(c, next);
          changed = true;
        }
      });
      if (!changed) break;
    }

    const groups = new Map();
    familyPeople.forEach((person) => {
      const group = find(person.id);
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(person);
    });

    const rows = new Map();
    groups.forEach((members, group) => {
      const row = level.get(group) || 0;
      if (!rows.has(row)) rows.set(row, []);
      members.sort((a, b) => a.x - b.x);
      rows.get(row).push({
        members,
        x: members.reduce((sum, person) => sum + person.x, 0) / members.length,
      });
    });

    const rowGap = 150;
    const unitGap = 74;
    const maxWidth = Math.max(
      ...([...rows.values()].map((units) => units.reduce((sum, unit) => sum + unit.members.length * NODE_W + (unit.members.length - 1) * 28, 0) + Math.max(0, units.length - 1) * unitGap))
    );
    const totalWidth = Math.max(maxWidth, 800);
    const baseX = 240;

    [...rows.entries()].sort((a, b) => a[0] - b[0]).forEach(([rowIndex, units]) => {
      units.sort((a, b) => a.x - b.x);
      const rowWidth = units.reduce((sum, unit) => sum + unit.members.length * NODE_W + (unit.members.length - 1) * 28, 0) + Math.max(0, units.length - 1) * unitGap;
      let cursor = baseX + (totalWidth - rowWidth) / 2;
      units.forEach((unit) => {
        unit.members.forEach((person, index) => {
          person.x = clamp(cursor + index * (NODE_W + 28), 24, WORLD_W - NODE_W - 24);
          person.y = clamp(140 + rowIndex * (NODE_H + rowGap), 24, WORLD_H - NODE_H - 24);
        });
        cursor += unit.members.length * NODE_W + (unit.members.length - 1) * 28 + unitGap;
      });
    });

    let familyBottom = 0;
    let familyCenterX = baseX + 400;
    if (familyPeople.length) {
      const xs = familyPeople.map((person) => person.x);
      familyBottom = Math.max(...familyPeople.map((person) => person.y + NODE_H));
      familyCenterX = (Math.min(...xs) + Math.max(...xs) + NODE_W) / 2;
    }

    if (knownPeople.length) {
      const anchor = new Map();
      knownPeople.forEach((person) => {
        let bestX = null;
        let bestWeight = Infinity;
        relationsOf(person.id).forEach((relation) => {
          if (!isSocialRelation(relation)) return;
          const otherId = relation.from === person.id ? relation.to : relation.from;
          const other = personById(otherId);
          if (!other || !familyIds.has(other.id)) return;
          const weight = relationWeight(relation);
          if (weight < bestWeight) {
            bestWeight = weight;
            bestX = other.x;
          }
        });
        anchor.set(person.id, bestX == null ? person.x : bestX);
      });
      const ordered = knownPeople.slice().sort(
        (a, b) => anchor.get(a.id) - anchor.get(b.id) || a.name.localeCompare(b.name, "es")
      );
      const gap = 18;
      const compactRowGap = 40;
      const perRow = clamp(
        Math.floor((Math.max(totalWidth, 860) + gap) / (NODE_W + gap)),
        3,
        6
      );
      const top = familyPeople.length ? familyBottom + 118 : 140;
      ordered.forEach((person, index) => {
        const row = Math.floor(index / perRow);
        const col = index % perRow;
        const rowCount = Math.min(perRow, ordered.length - row * perRow);
        const rowWidth = rowCount * NODE_W + (rowCount - 1) * gap;
        const rowStart = clamp(familyCenterX - rowWidth / 2, 24, WORLD_W - rowWidth - 24);
        person.x = rowStart + col * (NODE_W + gap);
        person.y = top + row * (NODE_H + compactRowGap);
      });
    }

    saveData();
    renderAll();
    window.requestAnimationFrame(() => fitView(true));
    if (!silent) {
      toast(
        knownPeople.length
          ? "Árbol organizado: familia por generaciones y conocidos en una franja aparte."
          : "Árbol organizado por generaciones.",
        "success"
      );
    }
  }

  /* ---------------- Grupos de familia ---------------- */
  function setActiveGroup(groupId, { fit = true, saveView = true } = {}) {
    const group = groupById(groupId);
    if (!group) return;
    if (group.id === activeGroupId() && !fit) return;
    hideContactCard();
    if (saveView) {
      const current = activeGroupId();
      if (current) groupViews[current] = { ...(ui.radial ? ui.radial.view : view) };
    }
    restoreRadialPositions();
    ui.activeGroupId = group.id;
    ui.selectedId = null;
    ui.focusRootId = null;
    ui.connect.active = false;
    ui.connect.fromId = null;
    ui.connect.pointer = null;
    renderAll();
    const savedView = groupViews[group.id];
    if (savedView) {
      view = normalizeView(savedView);
      applyView();
      scheduleSave();
    } else if (fit) {
      window.requestAnimationFrame(() => fitView(true));
    }
    if (isNarrow()) els.app.classList.remove("left-open", "detail-open");
    updatePanelChrome();
  }

  /* ---------------- Modo vincular ---------------- */
  function updateConnectUI() {
    const active = ui.connect.active;
    els.connectBtn.classList.toggle("active", active);
    els.connectBtn.setAttribute("aria-pressed", String(active));
    const label = els.connectBtn.querySelector("span");
    if (label) label.textContent = active ? "Cancelar" : "Vincular";
    els.viewport.classList.toggle("connect-mode", active);

    els.nodeLayer.querySelectorAll(".node").forEach((node) => {
      node.classList.toggle(
        "connect-source",
        active && !!ui.connect.fromId && node.dataset.id === ui.connect.fromId
      );
    });

    if (!active) {
      els.connectHint.classList.add("hidden");
      els.connectHint.textContent = "";
      updatePendingLine();
      return;
    }

    els.connectHint.classList.remove("hidden");
    els.connectHint.innerHTML = "";
    const text = document.createElement("span");
    const from = personById(ui.connect.fromId);
    if (from) {
      text.append(document.createTextNode("Elige con quién conectar a "));
      const strong = document.createElement("strong");
      strong.textContent = from.name;
      text.appendChild(strong);
    } else {
      text.textContent = "Elige la primera persona del vínculo";
    }
    const esc = el("kbd", null, "Esc");
    els.connectHint.append(text, esc);
    updatePendingLine();
  }

  function startConnect(fromId = null) {
    if (!data.people.length) {
      toast("Crea al menos una persona antes de vincular.", "error");
      return;
    }
    ui.connect.active = true;
    ui.connect.fromId = fromId || null;
    ui.connect.pointer = null;
    if (isNarrow()) els.app.classList.remove("left-open", "detail-open");
    updateConnectUI();
  }

  function cancelConnect() {
    if (!ui.connect.active) {
      updatePendingLine();
      return;
    }
    ui.connect.active = false;
    ui.connect.fromId = null;
    ui.connect.pointer = null;
    updateConnectUI();
  }

  /* ---------------- Render global ---------------- */
  function updateChrome() {
    const group = activeGroup();
    const count = group ? peopleInGroup(group.id).length : 0;
    els.peopleCount.textContent = String(count);
    if (els.groupsCount) els.groupsCount.textContent = String(data.groups.length);
    if (els.activeGroupLabel) {
      els.activeGroupLabel.textContent = group ? `Árbol activo: ${group.name}` : "Sin grupo activo";
    }
    els.emptyState.classList.toggle("hidden", count > 0);
    updateViewChrome();
    updatePanelChrome();
  }

  function renderAll() {
    hideContactCard();
    if (ui.radial) {
      const center = personById(ui.radial.centerId);
      if (!ui.selectedId || !center) restoreRadialPositions();
    }
    renderGroups();
    renderPeopleList();
    renderNodes();
    renderEdges();
    renderDetail();
    updateChrome();
    updateConnectUI();
  }

  /* ---------------- Selección y avisos ---------------- */
  /* ---------------- Disposición radial (mapa mental) ---------------- */
  function peopleForStorage() {
    if (!ui.radial) return data.people;
    return data.people.map((person) => {
      const original = ui.radial.originals.get(person.id);
      return original ? { ...person, x: original.x, y: original.y } : person;
    });
  }

  function restoreRadialPositions() {
    if (!ui.radial) return null;
    ui.radial.originals.forEach((position, id) => {
      const person = personById(id);
      if (!person) return;
      person.x = position.x;
      person.y = position.y;
    });
    const savedView = ui.radial.view;
    ui.radial = null;
    return savedView;
  }

  function radialPositions(centerId, people) {
    const ids = new Set(people.map((person) => person.id));
    if (!ids.has(centerId)) return null;
    const relations = visibleRelations().filter(
      (relation) => ids.has(relation.from) && ids.has(relation.to)
    );

    const adjacency = new Map();
    relations.forEach((relation) => {
      const weight = relationWeight(relation);
      if (!adjacency.has(relation.from)) adjacency.set(relation.from, []);
      if (!adjacency.has(relation.to)) adjacency.set(relation.to, []);
      adjacency.get(relation.from).push({ id: relation.to, weight });
      adjacency.get(relation.to).push({ id: relation.from, weight });
    });

    const depth = new Map([[centerId, 0]]);
    const queue = [centerId];
    while (queue.length) {
      const id = queue.shift();
      (adjacency.get(id) || []).forEach(({ id: nextId }) => {
        if (depth.has(nextId)) return;
        depth.set(nextId, depth.get(id) + 1);
        queue.push(nextId);
      });
    }

    const distance = new Map([[centerId, 0]]);
    const visited = new Set();
    while (visited.size < people.length) {
      let bestId = null;
      let best = Infinity;
      people.forEach((person) => {
        if (visited.has(person.id)) return;
        const value = distance.has(person.id) ? distance.get(person.id) : Infinity;
        if (value < best) {
          best = value;
          bestId = person.id;
        }
      });
      if (bestId == null) break;
      visited.add(bestId);
      (adjacency.get(bestId) || []).forEach(({ id: nextId, weight }) => {
        if (visited.has(nextId)) return;
        const next = best + weight;
        if (next < (distance.has(nextId) ? distance.get(nextId) : Infinity)) {
          distance.set(nextId, next);
        }
      });
    }

    const rings = new Map();
    const maxDepth = depth.size ? Math.max(...depth.values()) : 0;
    people.forEach((person) => {
      const ring = depth.has(person.id) ? depth.get(person.id) : maxDepth + 1;
      if (!rings.has(ring)) rings.set(ring, []);
      rings.get(ring).push(person);
    });

    const sum = people.reduce(
      (acc, person) => ({ x: acc.x + person.x + NODE_W / 2, y: acc.y + person.y + NODE_H / 2 }),
      { x: 0, y: 0 }
    );
    const cx = clamp(sum.x / people.length, 260, WORLD_W - 260);
    const cy = clamp(sum.y / people.length, 220, WORLD_H - 220);

    const positions = new Map([[centerId, { x: cx - NODE_W / 2, y: cy - NODE_H / 2 }]]);
    const ringKeys = [...rings.keys()].filter((ring) => ring > 0).sort((a, b) => a - b);
    const arc = Math.max(NODE_W, NODE_H) + 44;
    let previousRadius = 0;
    ringKeys.forEach((ringKey, index) => {
      const items = rings.get(ringKey).slice().sort((a, b) => {
        const da = distance.has(a.id) ? distance.get(a.id) : Infinity;
        const db = distance.has(b.id) ? distance.get(b.id) : Infinity;
        return da - db || a.name.localeCompare(b.name, "es");
      });
      const count = items.length;
      const needed = (count * arc) / (Math.PI * 2);
      const radius = Math.max(index === 0 ? 380 : previousRadius + 320, needed + 60);
      previousRadius = radius;
      const step = (Math.PI * 2) / count;
      const offset = -Math.PI / 2 + (index % 2 ? step / 2 : 0);
      items.forEach((person, positionIndex) => {
        const angle = offset + positionIndex * step;
        positions.set(person.id, {
          x: clamp(cx + Math.cos(angle) * radius - NODE_W / 2, 24, WORLD_W - NODE_W - 24),
          y: clamp(cy + Math.sin(angle) * radius - NODE_H / 2, 24, WORLD_H - NODE_H - 24),
        });
      });
    });

    return positions;
  }

  function applyRadialLayout(centerId) {
    const group = activeGroup();
    if (!group) return;
    let backup = ui.radial;
    if (backup) {
      restoreRadialPositions();
    } else {
      const originals = new Map();
      peopleInGroup(group.id).forEach((person) => {
        originals.set(person.id, { x: person.x, y: person.y });
      });
      backup = { originals, view: { ...view } };
    }
    const people = visiblePeople();
    if (people.length < 2 || !people.some((person) => person.id === centerId)) {
      ui.radial = null;
      return;
    }
    const positions = radialPositions(centerId, people);
    if (!positions) {
      ui.radial = null;
      return;
    }
    positions.forEach((position, id) => {
      const person = personById(id);
      if (!person) return;
      person.x = position.x;
      person.y = position.y;
    });
    ui.radial = { centerId, originals: backup.originals, view: backup.view };
  }

  function selectPerson(personId, options = {}) {
    const person = personById(personId);
    const group = activeGroup();
    if (!person || !group || person.groupId !== group.id) return;
    if (ui.selectedId === personId && ui.radial) {
      renderDetail();
      if (options.openPanel !== false && isNarrow()) {
        els.app.classList.add("detail-open");
      }
      return;
    }
    hideContactCard();
    ui.selectedId = personId;
    applyRadialLayout(personId);
    renderPeopleList();
    renderNodes();
    renderEdges();
    renderDetail();
    if (ui.radial) window.requestAnimationFrame(() => fitView(true));
    if (options.openPanel !== false && isNarrow()) {
      els.app.classList.add("detail-open");
    }
  }

  function clearSelection() {
    hideContactCard();
    ui.selectedId = null;
    const savedView = restoreRadialPositions();
    renderPeopleList();
    renderNodes();
    renderEdges();
    renderDetail();
    if (savedView) animateTo(savedView, 320);
  }

  function toast(message, type = "info") {
    const node = el("div", `toast ${type}`, message);
    els.toastHost.appendChild(node);
    while (els.toastHost.children.length > 4) {
      els.toastHost.firstElementChild.remove();
    }
    window.setTimeout(() => {
      node.classList.add("out");
      window.setTimeout(() => node.remove(), 230);
    }, 3400);
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await Promise.race([
          navigator.clipboard.writeText(text),
          new Promise((_, reject) => window.setTimeout(() => reject(new Error("timeout")), 1200)),
        ]);
        return true;
      } catch {
        /* probamos el método clásico */
      }
    }
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const copied = document.execCommand("copy");
      area.remove();
      return copied;
    } catch {
      return false;
    }
  }

  function openDialog(dialog) {
    if (!dialog || dialog.open) return;
    dialog.showModal();
  }

  function closeDialog(dialog) {
    if (dialog && dialog.open) dialog.close();
  }

  function askConfirm({ title, message, confirmLabel = "Eliminar", tone = "danger" }) {
    return new Promise((resolve) => {
      const dialog = els.confirmDialog;
      if (dialog.open) {
        resolve(false);
        return;
      }

      const okBtn = els.confirmOkBtn;
      const cancelBtn = els.confirmCancelBtn;
      els.confirmTitle.textContent = title;
      els.confirmMessage.textContent = message;
      okBtn.textContent = confirmLabel;
      okBtn.className = `btn ${tone === "danger" ? "btn-danger" : "btn-primary"}`;

      let settled = false;

      const cleanup = () => {
        okBtn.removeEventListener("click", onOk);
        cancelBtn.removeEventListener("click", onCancel);
        dialog.removeEventListener("close", onClose);
      };

      const finish = (value) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (dialog.open) dialog.close();
        resolve(value);
      };

      const onOk = () => finish(true);
      const onCancel = () => finish(false);
      const onClose = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(false);
      };

      okBtn.addEventListener("click", onOk);
      cancelBtn.addEventListener("click", onCancel);
      dialog.addEventListener("close", onClose);
      openDialog(dialog);
    });
  }

  /* ---------------- Personajes ---------------- */
  function populatePersonGroups(selectedId) {
    els.personGroup.innerHTML = "";
    data.groups.forEach((group) => {
      const option = document.createElement("option");
      option.value = group.id;
      option.textContent = group.name;
      els.personGroup.appendChild(option);
    });
    const fallback = activeGroupId() || (data.groups[0] ? data.groups[0].id : "");
    els.personGroup.value = data.groups.some((group) => group.id === selectedId) ? selectedId : fallback;
  }

  function avatarFieldValue() {
    return els.personAvatarUrl.value.trim() || ui.avatarDraft;
  }

  function refreshAvatarPreview() {
    if (!els.personAvatarPreview) return;
    const value = avatarFieldValue();
    els.personAvatarPreview.innerHTML = "";
    paintAvatar(els.personAvatarPreview, {
      name: els.personName.value.trim() || "?",
      avatar: isSafeImageUrl(value) ? value : "",
      groupId: els.personGroup.value || null,
    });
  }

  function updateAvatarControls() {
    const urlValue = els.personAvatarUrl.value.trim();
    const hasImage = !!urlValue || !!ui.avatarDraft;
    els.personAvatarUpload.textContent = hasImage ? "Cambiar imagen" : "Subir imagen";
    els.personAvatarAdjust.disabled = !hasImage || (!!urlValue && !isSafeImageUrl(urlValue));
    els.personAvatarClear.disabled = !hasImage;
    els.personAvatarHelp.textContent = hasImage
      ? "La foto se mostrará en un cuadrado con esquinas redondeadas."
      : "JPG, PNG o WebP. Al subirla podrás recortarla y elegir la zona visible.";
  }

  function setAvatarDraft(value, { syncUrl = false } = {}) {
    ui.avatarDraft = String(value || "").trim();
    els.personAvatar.value = ui.avatarDraft;
    if (syncUrl) els.personAvatarUrl.value = isRemoteImageUrl(ui.avatarDraft) ? ui.avatarDraft : "";
    updateAvatarControls();
    refreshAvatarPreview();
  }

  function handleAvatarFile(file) {
    if (!file) return;
    if (file.type && !file.type.startsWith("image/")) {
      toast("Selecciona un archivo de imagen (JPG, PNG o WebP).", "error");
      return;
    }
    if (file.size > AVATAR_MAX_FILE_BYTES) {
      toast("La imagen supera los 12 MB. Prueba con un archivo más pequeño.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const source = typeof reader.result === "string" ? reader.result : "";
      if (!source) {
        toast("No se pudo leer la imagen.", "error");
        return;
      }
      openAvatarCrop(source);
    };
    reader.onerror = () => toast("No se pudo leer la imagen.", "error");
    reader.readAsDataURL(file);
  }

  function openAvatarCrop(source) {
    if (!source) return;
    cropState = {
      source,
      naturalW: 0,
      naturalH: 0,
      baseScale: 1,
      scale: 1,
      x: 0,
      y: 0,
      ready: false,
      dragging: null,
    };
    els.cropZoom.value = "1";
    els.cropZoomValue.textContent = "100%";
    els.avatarCropApply.disabled = true;
    els.cropImage.classList.remove("is-ready");
    els.cropStage.classList.remove("is-ready", "is-dragging");
    els.cropImage.onload = () => {
      if (!cropState || cropState.source !== source) return;
      initCropGeometry();
    };
    els.cropImage.onerror = () => {
      if (!cropState || cropState.source !== source) return;
      closeDialog(els.avatarCropDialog);
      toast("No se pudo abrir esa imagen. Prueba con otro archivo.", "error");
    };
    openDialog(els.avatarCropDialog);
    els.cropImage.src = source;
    window.requestAnimationFrame(() => {
      if (!cropState || cropState.source !== source) return;
      if (els.cropImage.complete && els.cropImage.naturalWidth) initCropGeometry();
    });
  }

  function initCropGeometry() {
    if (!cropState || cropState.ready) return;
    const size = els.cropStage.clientWidth;
    const iw = els.cropImage.naturalWidth;
    const ih = els.cropImage.naturalHeight;
    if (!size || !iw || !ih) return;
    cropState.naturalW = iw;
    cropState.naturalH = ih;
    cropState.baseScale = Math.max(size / iw, size / ih);
    cropState.scale = cropState.baseScale * (Number(els.cropZoom.value) || 1);
    cropState.x = (size - iw * cropState.scale) / 2;
    cropState.y = (size - ih * cropState.scale) / 2;
    cropState.ready = true;
    clampCropOffset();
    applyCropTransform();
    els.cropImage.classList.add("is-ready");
    els.cropStage.classList.add("is-ready");
    els.avatarCropApply.disabled = false;
  }

  function clampCropOffset() {
    if (!cropState) return;
    const size = els.cropStage.clientWidth;
    const width = cropState.naturalW * cropState.scale;
    const height = cropState.naturalH * cropState.scale;
    cropState.x = Math.min(0, Math.max(size - width, cropState.x));
    cropState.y = Math.min(0, Math.max(size - height, cropState.y));
  }

  function applyCropTransform() {
    if (!cropState) return;
    const width = cropState.naturalW * cropState.scale;
    const height = cropState.naturalH * cropState.scale;
    els.cropImage.style.width = `${width}px`;
    els.cropImage.style.height = `${height}px`;
    els.cropImage.style.transform = `translate3d(${cropState.x}px, ${cropState.y}px, 0)`;
  }

  function setCropZoom(value) {
    if (!cropState || !cropState.ready) return;
    const zoom = clamp(Number(value) || 1, 1, 3);
    const size = els.cropStage.clientWidth;
    const centerX = (size / 2 - cropState.x) / cropState.scale;
    const centerY = (size / 2 - cropState.y) / cropState.scale;
    cropState.scale = cropState.baseScale * zoom;
    cropState.x = size / 2 - centerX * cropState.scale;
    cropState.y = size / 2 - centerY * cropState.scale;
    clampCropOffset();
    applyCropTransform();
    els.cropZoomValue.textContent = `${Math.round(zoom * 100)}%`;
  }

  function saveAvatarCrop() {
    if (!cropState || !cropState.ready) return;
    const size = els.cropStage.clientWidth;
    const scale = cropState.scale;
    const sourceX = clamp(-cropState.x / scale, 0, cropState.naturalW);
    const sourceY = clamp(-cropState.y / scale, 0, cropState.naturalH);
    const sourceSize = Math.min(
      size / scale,
      cropState.naturalW - sourceX,
      cropState.naturalH - sourceY
    );
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_OUTPUT_SIZE;
    canvas.height = AVATAR_OUTPUT_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx || sourceSize <= 0) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    let dataUrl = "";
    try {
      ctx.drawImage(
        els.cropImage,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        0,
        0,
        AVATAR_OUTPUT_SIZE,
        AVATAR_OUTPUT_SIZE
      );
      dataUrl = canvas.toDataURL("image/jpeg", 0.88);
    } catch {
      toast("No se pudo recortar esta imagen externa. Sube el archivo para ajustarla.", "error");
      return;
    }
    setAvatarDraft(dataUrl, { syncUrl: true });
    closeDialog(els.avatarCropDialog);
    toast("Foto recortada. Guarda el personaje para aplicarla.", "success");
  }

  function endCropDrag() {
    if (!cropState || !cropState.dragging) return;
    const { pointerId } = cropState.dragging;
    cropState.dragging = null;
    els.cropStage.classList.remove("is-dragging");
    if (els.cropStage.hasPointerCapture && els.cropStage.hasPointerCapture(pointerId)) {
      try {
        els.cropStage.releasePointerCapture(pointerId);
      } catch {
        /* captura ya liberada */
      }
    }
  }

  function openPersonDialog(personId = null, placement = null) {
    const person = personId ? personById(personId) : null;
    ui.personEditId = person ? person.id : null;
    ui.personPlacement = placement || null;

    els.personDialogTitle.textContent = person ? "Editar personaje" : "Nuevo personaje";
    els.personDialogEyebrow.textContent = person ? "Ficha de personaje" : "Nueva ficha";
    els.personName.value = person ? person.name : "";
    ui.avatarDraft = person && person.avatar ? person.avatar : "";
    els.personAvatar.value = ui.avatarDraft;
    els.personAvatarFile.value = "";
    els.personAvatarUrl.value = isRemoteImageUrl(ui.avatarDraft) ? ui.avatarDraft : "";
    els.personAvatarUrlDetails.open = isRemoteImageUrl(ui.avatarDraft);
    els.personDesc.value = person ? person.description : "";

    ensureGroup();
    const active = activeGroup();
    const defaultGroupId = person ? person.groupId : active ? active.id : "";

    populatePersonGroups(defaultGroupId);
    updateAvatarControls();
    refreshAvatarPreview();
    els.personDeleteBtn.classList.toggle("hidden", !person);

    openDialog(els.personDialog);
    window.requestAnimationFrame(() => {
      if (!person && els.searchInput.value) {
        /* nada: conservamos la búsqueda */
      }
      els.personName.focus();
      if (person) els.personName.select();
    });
  }

  function handlePersonSubmit(event) {
    event.preventDefault();

    const name = els.personName.value.trim();
    if (!name) {
      toast("Ponle un nombre al personaje.", "error");
      els.personName.focus();
      return;
    }

    const avatarRaw = avatarFieldValue();
    if (avatarRaw && !isSafeImageUrl(avatarRaw)) {
      toast("La imagen no es válida. Sube un archivo o usa una dirección http(s).", "error");
      els.personAvatarUrlDetails.open = true;
      els.personAvatarUrl.focus();
      return;
    }

    const groupValue = els.personGroup.value;
    const targetGroup = groupById(groupValue) || ensureGroup();
    const groupId = targetGroup.id;
    const description = els.personDesc.value.trim();
    let newId = null;

    if (ui.personEditId) {
      const person = personById(ui.personEditId);
      if (!person) return;
      const previousGroupId = person.groupId;
      person.name = name;
      person.avatar = avatarRaw;
      person.groupId = groupId;
      person.description = description;
      if (previousGroupId !== groupId) {
        const validIds = new Set(
          peopleInGroup(groupId)
            .filter((other) => other.id !== person.id)
            .map((other) => other.id)
        );
        data.relations = data.relations.filter((relation) => {
          if (relation.from !== person.id && relation.to !== person.id) return true;
          const otherId = relation.from === person.id ? relation.to : relation.from;
          return validIds.has(otherId);
        });
        if (ui.focusRootId === person.id) ui.focusRootId = null;
        ui.activeGroupId = groupId;
        toast(`Ficha actualizada. Movida a «${targetGroup.name}»; se quitaron los vínculos con el grupo anterior.`, "success");
      } else {
        toast("Ficha actualizada.", "success");
      }
    } else {
      let x;
      let y;
      if (ui.personPlacement) {
        x = ui.personPlacement.x;
        y = ui.personPlacement.y;
      } else {
        const rect = viewportRect();
        const center = screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
        x = center.x - NODE_W / 2 + (Math.random() * 36 - 18);
        y = center.y - NODE_H / 2 + (Math.random() * 36 - 18);
      }

      const person = {
        id: uid("p"),
        name,
        groupId,
        avatar: avatarRaw,
        description,
        x: clamp(x, 24, WORLD_W - NODE_W - 24),
        y: clamp(y, 24, WORLD_H - NODE_H - 24),
      };
      rememberGroupView();
      ui.activeGroupId = groupId;
      data.people.push(person);
      newId = person.id;
      ui.selectedId = person.id;
      toast("Personaje añadido.", "success");
    }

    saveData();
    closeDialog(els.personDialog);
    renderAll();

    if (newId) {
      focusPerson(newId);
      if (isNarrow()) els.app.classList.add("detail-open");
    }
  }

  async function confirmDeletePerson(personId) {
    const person = personById(personId);
    if (!person) return;

    const ok = await askConfirm({
      title: "Eliminar personaje",
      message: `Se eliminará a «${person.name}» junto con todos sus vínculos. Esta acción no se puede deshacer.`,
      confirmLabel: "Eliminar personaje",
    });
    if (!ok) return;

    if (ui.personEditId === personId) closeDialog(els.personDialog);
    data.people = data.people.filter((p) => p.id !== personId);
    data.relations = data.relations.filter((r) => r.from !== personId && r.to !== personId);
    if (ui.selectedId === personId) {
      ui.selectedId = null;
      els.app.classList.remove("detail-open");
    }
    saveData();
    renderAll();
    toast("Personaje eliminado.");
  }

  /* ---------------- Vínculos ---------------- */
  function findRelationBetween(a, b) {
    return data.relations.find(
      (r) => (r.from === a && r.to === b) || (r.from === b && r.to === a)
    ) || null;
  }

  function openRelationDialog(relationId = null, fromId = null, toId = null) {
    let relation = relationId ? data.relations.find((r) => r.id === relationId) : null;
    if (relationId && !relation) {
      toast("Ese vínculo ya no existe.", "error");
      return;
    }

    if (relation) {
      fromId = relation.from;
      toId = relation.to;
    } else {
      const existing = findRelationBetween(fromId, toId);
      if (existing) {
        relation = existing;
        ui.selectedRelationId = existing.id;
        toast("Ya existía un vínculo entre estas personas. Puedes ajustarlo.");
      }
    }

    const personA = personById(fromId);
    const personB = personById(toId);
    if (!personA || !personB) {
      toast("No se encontraron las personas del vínculo.", "error");
      return;
    }

    ui.relationCtx = { id: relation ? relation.id : null, from: fromId, to: toId };
    ui.selectedRelationId = relation ? relation.id : null;

    els.relationDialogTitle.textContent = relation ? "Editar vínculo" : "Nuevo vínculo";
    els.relationNames.innerHTML = "";
    const strongA = el("strong", null, personA.name);
    const strongB = el("strong", null, personB.name);
    els.relationNames.append(strongA, document.createTextNode("  ↔  "), strongB);

    els.relationTypes.innerHTML = "";
    REL_TYPES.forEach((type) => {
      const option = document.createElement("label");
      option.className = "rel-option";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "relType";
      input.value = type.id;
      if (relation && relation.type === type.id) input.checked = true;

      const sample = el("span", "rel-sample");
      const solid = document.createElement("span");
      const familyType = FAMILY_TYPES.has(type.id);
      solid.style.height = `${familyType ? type.width : Math.max(2, type.width)}px`;
      solid.style.background = familyType
        ? type.color
        : `repeating-linear-gradient(90deg, ${type.color} 0 5px, transparent 5px 8px)`;
      sample.appendChild(solid);

      const copy = el("span", "rel-option-copy");
      copy.appendChild(el("span", "rel-option-name", type.label));
      copy.appendChild(el("span", "rel-option-desc", type.desc));

      option.append(input, sample, copy);
      input.addEventListener("change", () => {
        els.relationSaveBtn.disabled = false;
      });
      els.relationTypes.appendChild(option);
    });

    if (els.relLabel) els.relLabel.value = relation && relation.label ? relation.label : "";
    els.relationSaveBtn.disabled = !relation;
    els.relationSaveBtn.textContent = relation ? "Guardar cambios" : "Crear vínculo";
    els.relationDeleteBtn.classList.toggle("hidden", !relation);

    renderEdges();
    openDialog(els.relationDialog);
  }

  function handleRelationSave() {
    const ctx = ui.relationCtx;
    if (!ctx) return;
    const checked = els.relationTypes.querySelector('input[name="relType"]:checked');
    if (!checked) return;
    const label = els.relLabel ? els.relLabel.value.trim().slice(0, 40) : "";

    if (ctx.id) {
      const relation = data.relations.find((r) => r.id === ctx.id);
      if (!relation) {
        toast("Ese vínculo ya no existe.", "error");
        return;
      }
      relation.type = checked.value;
      if (label) relation.label = label;
      else delete relation.label;
      toast("Vínculo actualizado.", "success");
    } else {
      if (findRelationBetween(ctx.from, ctx.to)) {
        toast("Ese vínculo ya existe. Edítalo en lugar de crear otro.", "error");
        return;
      }
      const relation = {
        id: uid("r"),
        from: ctx.from,
        to: ctx.to,
        type: checked.value,
      };
      if (label) relation.label = label;
      data.relations.push(relation);
      toast("Vínculo creado.", "success");
    }

    saveData();
    ui.selectedRelationId = null;
    ui.relationCtx = null;
    cancelConnect();
    closeDialog(els.relationDialog);
    renderAll();
  }

  async function confirmDeleteRelation() {
    const ctx = ui.relationCtx;
    if (!ctx || !ctx.id) return;
    const relation = data.relations.find((r) => r.id === ctx.id);
    if (!relation) return;

    const personA = personById(relation.from);
    const personB = personById(relation.to);
    const ok = await askConfirm({
      title: "Eliminar vínculo",
      message: `Se eliminará el vínculo entre «${personA ? personA.name : "?"}» y «${personB ? personB.name : "?"}».`,
      confirmLabel: "Eliminar vínculo",
    });
    if (!ok) return;

    data.relations = data.relations.filter((r) => r.id !== relation.id);
    ui.selectedRelationId = null;
    ui.relationCtx = null;
    saveData();
    cancelConnect();
    closeDialog(els.relationDialog);
    renderAll();
    toast("Vínculo eliminado.");
  }

  /* ---------------- Grupos de familia ---------------- */
  function buildSwatches() {
    els.groupColors.innerHTML = "";
    GROUP_COLORS.forEach((color) => {
      const swatch = el("button", "swatch" + (color === ui.groupColor ? " active" : ""));
      swatch.type = "button";
      swatch.style.setProperty("--sw", color);
      swatch.title = color;
      swatch.setAttribute("aria-label", `Elegir color ${color}`);
      swatch.addEventListener("click", () => {
        ui.groupColor = color;
        buildSwatches();
      });
      els.groupColors.appendChild(swatch);
    });
  }

  function nextGroupColor() {
    const used = new Set(data.groups.map((group) => group.color));
    return GROUP_COLORS.find((color) => !used.has(color)) || GROUP_COLORS[data.groups.length % GROUP_COLORS.length];
  }

  function openGroupDialog(groupId = null) {
    const group = groupId ? groupById(groupId) : null;
    ui.groupEditId = group ? group.id : null;
    ui.groupColor = group ? group.color : nextGroupColor();

    els.groupDialogTitle.textContent = group ? "Editar grupo de familia" : "Nuevo grupo de familia";
    els.groupName.value = group ? group.name : "";
    els.groupDeleteBtn.classList.toggle("hidden", !group);
    buildSwatches();

    openDialog(els.groupDialog);
    window.requestAnimationFrame(() => {
      els.groupName.focus();
      if (group) els.groupName.select();
    });
  }

  function handleGroupSubmit(event) {
    event.preventDefault();
    const name = els.groupName.value.trim();
    if (!name) {
      toast("Ponle un nombre al grupo de familia.", "error");
      els.groupName.focus();
      return;
    }

    if (ui.groupEditId) {
      const group = groupById(ui.groupEditId);
      if (!group) return;
      group.name = name;
      group.color = ui.groupColor;
      toast("Grupo actualizado.", "success");
    } else {
      const group = {
        id: uid("g"),
        name,
        color: ui.groupColor,
      };
      rememberGroupView();
      data.groups.push(group);
      ui.activeGroupId = group.id;
      ui.selectedId = null;
      ui.focusRootId = null;
      toast("Grupo creado. Añade sus personajes.", "success");
    }

    saveData();
    closeDialog(els.groupDialog);
    renderAll();
    if (!ui.groupEditId) window.requestAnimationFrame(() => fitView(false));
  }

  async function confirmDeleteGroup(groupId) {
    const group = groupById(groupId);
    if (!group) return;
    if (data.groups.length <= 1) {
      toast("Crea otro grupo antes de eliminar este. Siempre debe quedar al menos uno.", "error");
      return;
    }
    const people = peopleInGroup(group.id);
    const count = people.length;

    const ok = await askConfirm({
      title: "Eliminar grupo de familia",
      message: count
        ? `Se eliminará «${group.name}» con ${plural(count, "personaje", "personajes")} y todos sus vínculos. Los demás grupos no se verán afectados.`
        : `Se eliminará el grupo «${group.name}». Los demás grupos no se verán afectados.`,
      confirmLabel: "Eliminar grupo",
    });
    if (!ok) return;

    const ids = new Set(people.map((person) => person.id));
    data.people = data.people.filter((person) => person.groupId !== groupId);
    data.relations = data.relations.filter(
      (relation) => !ids.has(relation.from) && !ids.has(relation.to)
    );
    data.groups = data.groups.filter((item) => item.id !== groupId);
    delete groupViews[groupId];

    const wasActive = ui.activeGroupId === groupId;
    if (wasActive) {
      rememberGroupView();
      ui.activeGroupId = data.groups[0] ? data.groups[0].id : null;
      ui.selectedId = null;
      ui.focusRootId = null;
    }
    saveData();
    closeDialog(els.groupDialog);
    renderAll();
    if (wasActive) window.requestAnimationFrame(() => fitView(true));
    toast("Grupo eliminado.");
  }

  /* ---------------- Interacción del lienzo ---------------- */
  function bindCanvasEvents() {
    const vp = els.viewport;

    vp.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      if (event.target.closest(".node") || event.target.closest(".edge-hit")) return;
      cancelViewAnim();
      hideContactCard();
      ui.pan = {
        sx: event.clientX,
        sy: event.clientY,
        ox: view.x,
        oy: view.y,
        moved: false,
      };
      try {
        vp.setPointerCapture(event.pointerId);
      } catch {
        /* el paneo sigue funcionando aunque no haya captura */
      }
      vp.classList.add("is-panning");
    });

    vp.addEventListener("pointermove", (event) => {
      if (ui.pan) hideContactCard();
      if (ui.connect.active && ui.connect.fromId) {
        ui.connect.pointer = screenToWorld(event.clientX, event.clientY);
        if (ui.pointerRaf == null) {
          ui.pointerRaf = window.requestAnimationFrame(() => {
            ui.pointerRaf = null;
            updatePendingLine();
          });
        }
      }

      if (!ui.pan) return;
      const dx = event.clientX - ui.pan.sx;
      const dy = event.clientY - ui.pan.sy;
      if (!ui.pan.moved && Math.hypot(dx, dy) > 3) ui.pan.moved = true;
      if (!ui.pan.moved) return;
      view.x = ui.pan.ox + dx;
      view.y = ui.pan.oy + dy;
      applyView();
    });

    const endPan = (event) => {
      if (!ui.pan) return;
      const wasMoved = ui.pan.moved;
      ui.pan = null;
      vp.classList.remove("is-panning");
      if (wasMoved) {
        scheduleSave();
      } else if (!ui.connect.active) {
        clearSelection();
        if (isNarrow()) els.app.classList.remove("detail-open");
      }
      if (event && event.pointerId != null && vp.hasPointerCapture(event.pointerId)) {
        try {
          vp.releasePointerCapture(event.pointerId);
        } catch {
          /* sin captura */
        }
      }
    };

    vp.addEventListener("pointerup", endPan);
    vp.addEventListener("pointercancel", endPan);

    vp.addEventListener("wheel", (event) => {
      event.preventDefault();
      hideContactCard();
      cancelViewAnim();
      const rect = vp.getBoundingClientRect();
      const unit = event.deltaMode === 1 ? 0.045 : 0.0015;
      const factor = Math.exp(-event.deltaY * unit);
      zoomAt(event.clientX - rect.left, event.clientY - rect.top, factor);
      if (ui.connect.active && ui.connect.fromId) {
        ui.connect.pointer = screenToWorld(event.clientX, event.clientY);
        updatePendingLine();
      }
    }, { passive: false });

    vp.addEventListener("dblclick", (event) => {
      if (event.target.closest(".node") || event.target.closest(".edge-hit")) return;
      if (ui.connect.active) cancelConnect();
      const point = screenToWorld(event.clientX, event.clientY);
      openPersonDialog(null, {
        x: point.x - NODE_W / 2,
        y: point.y - NODE_H / 2,
      });
    });
  }

  /* ---------------- Datos: exportar, importar, ejemplo ---------------- */
  function exportData() {
    const payload = {
      app: "nradiowave-rw",
      version: 2,
      exportedAt: new Date().toISOString(),
      groups: data.groups,
      people: peopleForStorage(),
      relations: data.relations,
    };
    try {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `nradiowave-rw-${nowStamp()}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      toast("Respaldo exportado.", "success");
    } catch (error) {
      console.error(error);
      toast("No se pudo exportar el respaldo.", "error");
    }
  }

  function resetWorkspaceUi() {
    cancelConnect();
    if (ui.radial) restoreRadialPositions();
    ui.radial = null;
    ui.selectedId = null;
    ui.selectedRelationId = null;
    ui.relationCtx = null;
    ui.query = "";
    ui.viewMode = "family";
    ui.focusRootId = null;
    if (els.searchInput) els.searchInput.value = "";
    els.app.classList.remove("detail-open", "left-open");
  }

  async function importFromFile(file) {
    if (!file) return;
    try {
      const text = await file.text();
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error("El archivo no contiene JSON válido.");
      }
      if (!parsed || !Array.isArray(parsed.people)) {
        throw new Error("El archivo no parece un árbol de Nradiowave R/W.");
      }
      const clean = sanitize(parsed);
      if (!clean.people.length && !clean.relations.length) {
        throw new Error("El archivo no contiene personajes.");
      }

      if (data.people.length) {
        const ok = await askConfirm({
          title: "Importar árbol",
          message: "Se reemplazarán todos los grupos, personajes y vínculos actuales por los del archivo. Exporta antes un respaldo si quieres conservarlos.",
          confirmLabel: "Importar",
          tone: "primary",
        });
        if (!ok) return;
      }

      resetWorkspaceUi();
      data = clean;
      ui.activeGroupId = data.groups[0] ? data.groups[0].id : null;
      groupViews = {};
      closeDialog(els.helpDialog);
      saveData();
      renderAll();
      window.requestAnimationFrame(() => fitView(false));
      toast(
        `Importados ${plural(clean.people.length, "personaje", "personajes")} y ${plural(clean.relations.length, "vínculo", "vínculos")}.`,
        "success"
      );
    } catch (error) {
      console.error(error);
      toast(error.message || "No se pudo importar el archivo.", "error");
    }
  }

  async function loadDemo() {
    if (data.people.length || data.groups.length > 1) {
      const ok = await askConfirm({
        title: "Cargar árbol de ejemplo",
        message: "Se reemplazará el contenido actual por el árbol de ejemplo de Kelly, Bard y sus hijas. Puedes exportar antes un respaldo.",
        confirmLabel: "Cargar ejemplo",
        tone: "primary",
      });
      if (!ok) return;
    }
    resetWorkspaceUi();
    data = demoData();
    ui.activeGroupId = data.groups[0] ? data.groups[0].id : null;
    groupViews = {};
    saveData();
    try {
      window.localStorage.setItem(LAYOUT_KEY, "1");
    } catch {
      /* sin persistencia */
    }
    renderAll();
    closeDialog(els.helpDialog);
    window.requestAnimationFrame(() => fitView(false));
    toast("Árbol de ejemplo cargado.", "success");
  }

  async function clearAll() {
    const ok = await askConfirm({
      title: "Vaciar el árbol",
      message: "Se borrarán todos los grupos de familia, personajes y vínculos de este navegador. Esta acción no se puede deshacer.",
      confirmLabel: "Vaciar todo",
    });
    if (!ok) return;

    resetWorkspaceUi();
    data = { groups: [], people: [], relations: [] };
    ensureGroup();
    groupViews = {};
    view = { x: 0, y: 0, k: 1 };
    applyView();
    saveData();
    renderAll();
    closeDialog(els.helpDialog);
    toast("El árbol quedó vacío.");
  }

  function openHelp() {
    buildLegend(els.helpLegend, true);
    openDialog(els.helpDialog);
  }

  function triggerImport() {
    closeDialog(els.helpDialog);
    els.fileInput.value = "";
    els.fileInput.click();
  }

  /* ---------------- Eventos ---------------- */
  function bindEvents() {
    els.addPersonBtn.addEventListener("click", () => openPersonDialog());
    els.canvasAddBtn.addEventListener("click", () => openPersonDialog());
    els.emptyAddBtn.addEventListener("click", () => openPersonDialog());
    els.emptyDemoBtn.addEventListener("click", () => loadDemo());

    els.addGroupBtn.addEventListener("click", () => openGroupDialog());
    els.menuBtn.addEventListener("click", toggleLeftPanel);
    els.detailToggleBtn.addEventListener("click", toggleDetailPanel);
    els.themeBtn.addEventListener("click", cycleTheme);
    els.scrim.addEventListener("click", () => {
      els.app.classList.remove("left-open", "detail-open");
      updatePanelChrome();
    });

    els.connectBtn.addEventListener("click", () => {
      if (ui.connect.active) cancelConnect();
      else startConnect(ui.selectedId || null);
    });

    els.familyViewBtn.addEventListener("click", () => setViewMode("family"));
    els.allViewBtn.addEventListener("click", () => setViewMode("all"));
    els.organizeBtn.addEventListener("click", () => organizeTree());
    els.focusBackBtn.addEventListener("click", exitFocusTree);

    els.zoomInBtn.addEventListener("click", () => zoomBy(1.2));
    els.zoomOutBtn.addEventListener("click", () => zoomBy(1 / 1.2));
    els.fitBtn.addEventListener("click", () => fitView(true));

    els.searchInput.addEventListener("input", () => {
      ui.query = els.searchInput.value;
      renderPeopleList();
    });
    els.searchInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      const first = els.peopleList.querySelector(".person-row");
      if (first) first.click();
    });

    els.exportBtn.addEventListener("click", exportData);
    els.helpExportBtn.addEventListener("click", exportData);
    els.importBtn.addEventListener("click", triggerImport);
    els.helpImportBtn.addEventListener("click", triggerImport);
    els.fileInput.addEventListener("change", async () => {
      const file = els.fileInput.files && els.fileInput.files[0];
      await importFromFile(file);
      els.fileInput.value = "";
    });

    els.helpBtn.addEventListener("click", openHelp);
    els.openHelpLink.addEventListener("click", openHelp);
    els.helpShareBtn.addEventListener("click", async () => {
      const url = window.location.href.split("#")[0];
      const copied = await copyText(url);
      if (copied) {
        toast("Enlace copiado. Compártelo con quien quieras editar el árbol.", "success");
      } else {
        window.prompt("Copia este enlace para compartir el árbol:", url);
      }
    });
    els.helpDemoBtn.addEventListener("click", loadDemo);
    els.helpResetBtn.addEventListener("click", clearAll);

    els.personForm.addEventListener("submit", handlePersonSubmit);
    els.personDeleteBtn.addEventListener("click", () => {
      if (ui.personEditId) confirmDeletePerson(ui.personEditId);
    });

    els.personName.addEventListener("input", refreshAvatarPreview);
    els.personGroup.addEventListener("change", refreshAvatarPreview);
    els.personAvatarUrl.addEventListener("input", updateAvatarControls);
    els.personAvatarUrl.addEventListener("change", () => {
      const value = els.personAvatarUrl.value.trim();
      if (!value) {
        if (isRemoteImageUrl(ui.avatarDraft)) setAvatarDraft("", { syncUrl: false });
        else {
          updateAvatarControls();
          refreshAvatarPreview();
        }
        return;
      }
      if (isSafeImageUrl(value)) setAvatarDraft(value, { syncUrl: false });
      else {
        updateAvatarControls();
        refreshAvatarPreview();
      }
    });
    els.personAvatarUpload.addEventListener("click", () => {
      els.personAvatarFile.value = "";
      els.personAvatarFile.click();
    });
    els.personAvatarFile.addEventListener("change", () => {
      const file = els.personAvatarFile.files && els.personAvatarFile.files[0];
      handleAvatarFile(file);
      els.personAvatarFile.value = "";
    });
    els.personAvatarAdjust.addEventListener("click", () => {
      const source = avatarFieldValue();
      if (source) openAvatarCrop(source);
    });
    els.personAvatarClear.addEventListener("click", () => {
      els.personAvatarUrl.value = "";
      setAvatarDraft("", { syncUrl: true });
    });

    els.cropZoom.addEventListener("input", () => setCropZoom(els.cropZoom.value));
    els.avatarCropApply.addEventListener("click", saveAvatarCrop);
    els.avatarCropCancel.addEventListener("click", () => closeDialog(els.avatarCropDialog));
    els.avatarCropClose.addEventListener("click", () => closeDialog(els.avatarCropDialog));
    els.avatarCropDialog.addEventListener("close", () => {
      cropState = null;
      els.avatarCropApply.disabled = true;
      els.cropImage.removeAttribute("src");
      els.cropImage.classList.remove("is-ready");
      els.cropStage.classList.remove("is-ready", "is-dragging");
    });

    els.cropStage.addEventListener("pointerdown", (event) => {
      if (!cropState || !cropState.ready || event.button !== 0) return;
      event.preventDefault();
      cropState.dragging = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: cropState.x,
        originY: cropState.y,
      };
      try {
        els.cropStage.setPointerCapture(event.pointerId);
      } catch {
        /* captura no disponible */
      }
      els.cropStage.classList.add("is-dragging");
    });
    els.cropStage.addEventListener("pointermove", (event) => {
      const drag = cropState && cropState.dragging;
      if (!drag || drag.pointerId !== event.pointerId) return;
      cropState.x = drag.originX + (event.clientX - drag.startX);
      cropState.y = drag.originY + (event.clientY - drag.startY);
      clampCropOffset();
      applyCropTransform();
    });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach((type) => {
      els.cropStage.addEventListener(type, endCropDrag);
    });
    els.cropStage.addEventListener("keydown", (event) => {
      if (!cropState || !cropState.ready) return;
      const step = event.shiftKey ? 32 : 10;
      const moves = {
        ArrowLeft: [step, 0],
        ArrowRight: [-step, 0],
        ArrowUp: [0, step],
        ArrowDown: [0, -step],
      };
      if (!moves[event.key]) return;
      event.preventDefault();
      cropState.x += moves[event.key][0];
      cropState.y += moves[event.key][1];
      clampCropOffset();
      applyCropTransform();
    });

    els.relationSaveBtn.addEventListener("click", handleRelationSave);
    els.relationDeleteBtn.addEventListener("click", confirmDeleteRelation);

    els.groupForm.addEventListener("submit", handleGroupSubmit);
    els.groupDeleteBtn.addEventListener("click", () => {
      if (ui.groupEditId) confirmDeleteGroup(ui.groupEditId);
    });

    document.querySelectorAll("[data-close-dialog]").forEach((button) => {
      button.addEventListener("click", () => {
        const dialog = $(button.getAttribute("data-close-dialog"));
        closeDialog(dialog);
      });
    });

    document.querySelectorAll("dialog.modal").forEach((dialog) => {
      dialog.addEventListener("click", (event) => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const outside =
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom;
        if (outside) closeDialog(dialog);
      });
    });

    els.personDialog.addEventListener("close", () => {
      ui.personEditId = null;
      ui.personPlacement = null;
      ui.avatarDraft = "";
      els.personAvatar.value = "";
      els.personAvatarFile.value = "";
    });
    els.relationDialog.addEventListener("close", () => {
      ui.relationCtx = null;
      ui.selectedRelationId = null;
      cancelConnect();
      renderEdges();
    });
    els.groupDialog.addEventListener("close", () => {
      ui.groupEditId = null;
    });
    els.helpDialog.addEventListener("close", () => {
      /* nada que restablecer */
    });

    document.addEventListener("keydown", (event) => {
      const target = event.target;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      const dialogOpen = !!document.querySelector("dialog[open]");

      if (event.key === "Escape") {
        if (!dialogOpen && ui.connect.active) {
          event.preventDefault();
          cancelConnect();
        }
        return;
      }
      if (dialogOpen || typing) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const key = event.key.toLowerCase();
      if (key === "n") {
        event.preventDefault();
        openPersonDialog();
      } else if (key === "v") {
        event.preventDefault();
        if (ui.connect.active) cancelConnect();
        else startConnect(ui.selectedId || null);
      } else if (key === "f") {
        event.preventDefault();
        fitView(true);
      }
    });

    const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemThemeChange = () => {
      if (themeMode === "auto") applyTheme();
    };
    if (typeof darkQuery.addEventListener === "function") {
      darkQuery.addEventListener("change", onSystemThemeChange);
    } else if (typeof darkQuery.addListener === "function") {
      darkQuery.addListener(onSystemThemeChange);
    }

    let resizeTimer = null;
    window.addEventListener("resize", () => {
      hideContactCard();
      updatePanelChrome();
      if (resizeTimer) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resizeTimer = null;
        if (isNarrow()) {
          els.app.classList.remove("left-collapsed", "detail-collapsed");
        }
        updatePanelChrome();
      }, 160);
    });

    window.addEventListener("beforeunload", () => {
      saveData();
    });
  }

  /* ---------------- Arranque ---------------- */
  function isDemoWorkspace() {
    const ids = ["p_kelly", "p_bard", "p_manu", "p_yana", "p_asya", "p_lila", "p_sasha"];
    return data.people.length === ids.length && ids.every((id) => personById(id));
  }

  function isLegacyDemoWorkspace(workspace) {
    const legacy = {
      p_elena: "Elena Valdoria",
      p_aldric: "Aldric Valdoria",
      p_corvin: "Corvin Valdoria",
      p_mara: "Mara Valdoria",
      p_tomas: "Tomás Valdoria",
      p_nia: "Nia Ferro",
      p_rowan: "Rowan Cale",
      p_iria: "Iria Valdoria",
      p_sable: "Sable",
      p_vex: "Vex",
    };
    const people = workspace && Array.isArray(workspace.people) ? workspace.people : [];
    if (people.length !== Object.keys(legacy).length) return false;
    return Object.entries(legacy).every(([id, name]) =>
      people.some((person) => person.id === id && person.name === name)
    );
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    if (!/^https?:$/.test(window.location.protocol) || !window.isSecureContext) return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(() => {
        /* sin soporte o sin permiso: la app funciona igual */
      });
    });
  }

  function init() {
    cacheDom();
    themeMode = readThemeMode();
    applyTheme();
    loadPanelState();
    bindEvents();
    bindCanvasEvents();

    const stored = readStore();
    let replaceLegacyExample = false;
    if (stored) {
      if (isLegacyDemoWorkspace(stored.data)) {
        data = demoData();
        view = { x: 0, y: 0, k: 1 };
        replaceLegacyExample = true;
      } else {
        data = stored.data;
        view = stored.view || { x: 0, y: 0, k: 1 };
        if (stored.activeGroupId) ui.activeGroupId = stored.activeGroupId;
        if (stored.groupViews) groupViews = { ...stored.groupViews };
      }
    } else {
      data = demoData();
    }
    ensureGroup();
    if (ui.activeGroupId && groupViews[ui.activeGroupId]) {
      view = normalizeView(groupViews[ui.activeGroupId]);
    }

    let migrateDemoLayout = false;
    if (stored && !replaceLegacyExample) {
      try {
        migrateDemoLayout = !readStored(LAYOUT_KEY, LEGACY_KEYS.layout) && isDemoWorkspace();
      } catch {
        migrateDemoLayout = false;
      }
    }

    applyView();
    renderAll();
    updatePanelChrome();
    if (stored && stored.legacy) saveData();

    if (replaceLegacyExample) {
      fitView(false);
      saveData();
      try {
        window.localStorage.setItem(LAYOUT_KEY, "1");
      } catch {
        /* sin persistencia */
      }
      window.setTimeout(() => {
        toast("Árbol de ejemplo renovado: ahora presenta a Kelly, Bard y sus tres hijas.", "success");
      }, 700);
    } else if (migrateDemoLayout) {
      organizeTree(true);
      try {
        window.localStorage.setItem(LAYOUT_KEY, "1");
      } catch {
        /* sin persistencia */
      }
    } else if (!stored || !stored.view) {
      fitView(false);
    }

    window.requestAnimationFrame(() => {
      if (!stored) {
        saveData();
        try {
          window.localStorage.setItem(LAYOUT_KEY, "1");
        } catch {
          /* sin persistencia */
        }
        window.setTimeout(() => {
          toast("Árbol de ejemplo cargado. Edita, arrastra o vacíalo desde «Ayuda y datos».");
        }, 700);
      }
    });

    startSync();
  }

  init();
  registerServiceWorker();
})();
