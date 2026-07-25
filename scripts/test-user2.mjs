// Prueba de Fase 2: segundo usuario se une a la banda por código de invitación.
const BASE = "http://localhost:3000";
const INVITE_CODE = process.argv[2];
const BAND_ID = process.argv[3];

const jar = new Map();

function storeCookies(res) {
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(";");
    const [name, ...v] = pair.split("=");
    jar.set(name.trim(), v.join("="));
  }
}

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { cookie: cookieHeader(), ...(opts.headers ?? {}) },
    redirect: "manual",
  });
  storeCookies(res);
  return res;
}

// 1. Registro (409 si ya existe, ok)
const reg = await req("/api/auth/register", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    name: "María",
    email: "maria@test.com",
    password: "secreto123",
  }),
});
console.log("register:", reg.status);

// 2. CSRF + login credentials
const csrfRes = await req("/api/auth/csrf");
const { csrfToken } = await csrfRes.json();

const login = await req("/api/auth/callback/credentials", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    csrfToken,
    email: "maria@test.com",
    password: "secreto123",
  }),
});
console.log("login:", login.status, jar.has("authjs.session-token") ? "session ok" : "SIN SESION");

// 3. Unirse a la banda
const join = await req("/api/bands/join", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ inviteCode: INVITE_CODE }),
});
console.log("join:", join.status, JSON.stringify(await join.json()));

// 4. Ver banda (miembros + canciones + letra persistida)
const band = await req(`/api/bands/${BAND_ID}`);
const data = await band.json();
console.log("band:", band.status);
console.log("members:", data.band.members.map((m) => `${m.user.name}(${m.role})`).join(", "));
console.log("songs:", data.band.songs.map((s) => s.title).join(", "));

// 5. María lee la canción (letra debe estar)
const songId = data.band.songs[0]?.id;
const song = await req(`/api/songs/${songId}`);
const songData = await song.json();
console.log("song GET:", song.status, "| lyrics:", JSON.stringify(songData.song.lyrics.slice(0, 40)) + "…");
