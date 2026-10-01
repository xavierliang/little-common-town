import fs from "node:fs";
import assert from "node:assert/strict";
import path from "node:path";
import crypto from "node:crypto";
const manifest = JSON.parse(
  fs.readFileSync("public/models/bakery/runtime-manifest.json", "utf8"),
);
const results = [];
for (const [key, item] of Object.entries(manifest.assets)) {
  const file = path.join("public", item.url.replace(/^\//, ""));
  const bytes = fs.readFileSync(file);
  assert.equal(
    crypto.createHash("sha256").update(bytes).digest("hex"),
    item.sha256,
    `${key}: content hash`,
  );
  if (!file.endsWith(".glb")) continue;
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, `${key}: GLB header`);
  assert.equal(bytes.readUInt32LE(4), 2, `${key}: glTF version`);
  assert.equal(bytes.readUInt32LE(8), bytes.length, `${key}: byte length`);
  const json = JSON.parse(
    bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString(),
  );
  assert.ok(
    (json.buffers ?? []).every((b) => !b.uri),
    `${key}: embedded buffers only`,
  );
  assert.ok(
    (json.images ?? []).every((i) => !i.uri),
    `${key}: embedded images only`,
  );
  const clips = (json.animations ?? []).map((a) => a.name).sort();
  if (key === "ahe" || key === "xiaoman") {
    assert.deepEqual(clips, ["Carry", "Idle", "Talk", "Walk", "Work"]);
    assert.equal(json.skins.length, 1, `${key}: one rig`);
    assert.equal(
      json.skins[0].joints.length,
      18,
      `${key}: preserved 18-bone rig`,
    );
  }
  if (key === "environment") assert.ok(clips.includes("Machine_Mix"));
  let triangles = 0,
    primitives = 0;
  for (const mesh of json.meshes ?? [])
    for (const p of mesh.primitives) {
      assert.equal(p.mode ?? 4, 4, `${key}: triangles`);
      triangles +=
        (p.indices !== undefined
          ? json.accessors[p.indices].count
          : json.accessors[p.attributes.POSITION].count) / 3;
      primitives++;
    }
  results.push({ key, bytes: bytes.length, triangles, primitives, clips });
}
assert.deepEqual(Object.keys(manifest.assets).sort(), [
  "ahe",
  "ahePortrait",
  "carry",
  "environment",
  "xiaoman",
  "xiaomanPortrait",
]);
console.log(JSON.stringify({ status: "passed", assets: results }, null, 2));
