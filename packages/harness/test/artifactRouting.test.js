import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectOwnerProcess,
  detectDocType,
  allowedDocTypesForProcess,
  isVerificationProcess,
  displayArtifactName,
  scopeArtifactsForProcess,
} from "../src/io/artifactRouting.js";

test("displayArtifactName strips the template/scaffolding folder", () => {
  assert.equal(
    displayArtifactName("2026년 템플릿/(문서번호)BSD_MAN3_Project_Plan.docx"),
    "(문서번호)BSD_MAN3_Project_Plan.docx"
  );
  // backslash paths (Windows webkitRelativePath) and bare names
  assert.equal(displayArtifactName("표준 템플릿\\BSD_SUP1_QA_보고서.docx"), "BSD_SUP1_QA_보고서.docx");
  assert.equal(displayArtifactName("srs.docx"), "srs.docx");
  // a meaningful sub-folder that is not a template is preserved
  assert.equal(displayArtifactName("SYS/BSD_SYS1_명세서.docx"), "SYS/BSD_SYS1_명세서.docx");
});

test("detectOwnerProcess resolves the process token from a filename", () => {
  assert.equal(detectOwnerProcess("(문서번호)BSD_MAN3_Project_Plan.docx"), "MAN.3");
  assert.equal(detectOwnerProcess("BSD_SUP1_QA_계획서.docx"), "SUP.1");
  assert.equal(detectOwnerProcess("BSD-SWE.1-Requirements.docx"), "SWE.1");
  assert.equal(detectOwnerProcess("BSD_SUP10_CM_Report.docx"), "SUP.10");
  // "SYSTEM" must not be misread as SYS-<n>
  assert.equal(detectOwnerProcess("System_Overview.docx"), null);
  assert.equal(detectOwnerProcess("requirements.pdf"), null);
});

test("detectDocType recognises Korean and English document types", () => {
  assert.equal(detectDocType("BSD_MAN3_Project_Plan.docx"), "plan");
  assert.equal(detectDocType("BSD_SUP1_QA_계획서.docx"), "plan");
  assert.equal(detectDocType("BSD_SUP1_QA_보고서.docx"), "report");
  assert.equal(detectDocType("BSD_SWE1_Requirements_명세서.docx"), "spec");
  assert.equal(detectDocType("BSD_SWE2_Architecture_설계서.docx"), "design");
  assert.equal(detectDocType("BSD_SWE6_Test_결과서.docx"), "result");
  // 결과보고서 reads as a report, not a result
  assert.equal(detectDocType("BSD_SWE6_결과보고서.docx"), "report");
  // 타당성 보고서 is its own type, NOT a generic report
  assert.equal(detectDocType("BSD_MAN3_타당성_보고서.docx"), "feasibility");
  assert.equal(detectDocType("MAN3_Feasibility_Study.docx"), "feasibility");
  assert.equal(detectDocType("random.txt"), null);
});

test("isVerificationProcess: test processes vs development processes", () => {
  assert.equal(isVerificationProcess({ category: "SWE", name: "Software Unit Verification" }), true);
  assert.equal(isVerificationProcess({ category: "SYS", name: "System Verification" }), true);
  assert.equal(isVerificationProcess({ category: "MLE", name: "Machine Learning Model Testing" }), true);
  assert.equal(isVerificationProcess({ category: "SWE", name: "Software Requirements Analysis" }), false);
  assert.equal(isVerificationProcess({ category: "SWE", name: "Software Architectural Design" }), false);
  // category gate: a SUP process named "...Verification" is not an engineering test process
  assert.equal(isVerificationProcess({ category: "SUP", name: "Problem Resolution Management" }), false);
});

test("allowedDocTypesForProcess: per-area CL1 evidence scope", () => {
  // SUP → 계획서 / 활동보고서 / 심사결과서
  assert.deepEqual(allowedDocTypesForProcess({ id: "SUP.1", category: "SUP" }), ["plan", "report", "result"]);
  // MAN.3 → 계획서 / 타당성 보고서
  assert.deepEqual(allowedDocTypesForProcess({ id: "MAN.3", category: "MAN" }), ["plan", "feasibility"]);
  // engineering development → 명세서 / 설계서 / 분석보고서
  assert.deepEqual(
    allowedDocTypesForProcess({ id: "SWE.1", category: "SWE", name: "Software Requirements Analysis" }),
    ["spec", "design", "report"]
  );
  // engineering verification/test → 검증·테스트 계획서 / 결과서
  assert.deepEqual(
    allowedDocTypesForProcess({ id: "SWE.6", category: "SWE", name: "Software Verification" }),
    ["plan", "result"]
  );
  // unrestricted areas
  assert.equal(allowedDocTypesForProcess({ id: "MAN.5", category: "MAN" }), null);
  assert.equal(allowedDocTypesForProcess({ id: "ACQ.4", category: "ACQ" }), null);
});

test("scopeArtifactsForProcess: 타당성 보고서 only feeds MAN.3, not other processes", () => {
  const feasibility = { name: "BSD_타당성_보고서.docx", wpidCandidates: [] }; // ownerless
  const man3 = { id: "MAN.3", category: "MAN", inputWorkProducts: [], outputWorkProducts: [] };
  const swe1 = { id: "SWE.1", category: "SWE", name: "Software Requirements Analysis", inputWorkProducts: [], outputWorkProducts: [] };
  const sup1 = { id: "SUP.1", category: "SUP", inputWorkProducts: [], outputWorkProducts: [] };
  assert.equal(scopeArtifactsForProcess(man3, [feasibility], { strict: true }).length, 1, "MAN.3 keeps feasibility report");
  assert.equal(scopeArtifactsForProcess(swe1, [feasibility], { strict: true }).length, 0, "engineering drops feasibility report");
  assert.equal(scopeArtifactsForProcess(sup1, [feasibility], { strict: true }).length, 0, "SUP drops feasibility report");
});

test("scopeArtifactsForProcess: engineering dev drops plans/results; test process keeps them", () => {
  const plan = { name: "BSD_검증_계획서.docx", wpidCandidates: [] };
  const result = { name: "BSD_테스트_결과서.docx", wpidCandidates: [] };
  const spec = { name: "BSD_요구사항_명세서.docx", wpidCandidates: [] };
  const dev = { id: "SWE.2", category: "SWE", name: "Software Architectural Design", inputWorkProducts: [], outputWorkProducts: [] };
  const ver = { id: "SWE.6", category: "SWE", name: "Software Verification", inputWorkProducts: [], outputWorkProducts: [] };
  const devScoped = scopeArtifactsForProcess(dev, [plan, result, spec], { strict: true }).map((a) => a.name);
  assert.deepEqual(devScoped, [spec.name], "dev keeps only the spec");
  const verScoped = scopeArtifactsForProcess(ver, [plan, result, spec], { strict: true }).map((a) => a.name);
  assert.deepEqual(verScoped.sort(), [plan.name, result.name].sort(), "test process keeps plan + result");
});

test("scopeArtifactsForProcess: docTypeScope:false (above CL1) lifts the doc-type restriction", () => {
  // Above CL1 every document type is admissible; only owner-based routing
  // applies. A 타당성 보고서 and a plan/result that CL1 would drop from a dev
  // process are admitted, while a doc owned by another process is still excluded.
  const dev = { id: "SWE.2", category: "SWE", name: "Software Architectural Design", inputWorkProducts: [], outputWorkProducts: [] };
  const feasibility = { name: "BSD_타당성_보고서.docx", wpidCandidates: [] };
  const plan = { name: "BSD_검증_계획서.docx", wpidCandidates: [] };
  const otherOwned = { name: "BSD_MAN3_Project_Plan.docx", wpidCandidates: [] };
  const cl1 = scopeArtifactsForProcess(dev, [feasibility, plan, otherOwned], { strict: true, docTypeScope: true }).map((a) => a.name);
  assert.deepEqual(cl1, [], "CL1 dev process admits none of these");
  const above = scopeArtifactsForProcess(dev, [feasibility, plan, otherOwned], { strict: true, docTypeScope: false }).map((a) => a.name);
  assert.deepEqual(above.sort(), [feasibility.name, plan.name].sort(), "above CL1 admits ownerless docs of any type, still drops MAN.3-owned");
});

test("scopeArtifactsForProcess: SUP keeps 심사결과서 (result) as evidence", () => {
  const sup1 = { id: "SUP.1", category: "SUP", inputWorkProducts: [], outputWorkProducts: [] };
  const auditResult = { name: "BSD_SUP1_심사_결과서.docx", wpidCandidates: [] };
  const scoped = scopeArtifactsForProcess(sup1, [auditResult], { strict: true });
  assert.equal(scoped.length, 1, "SUP keeps audit result report");
});

test("scopeArtifactsForProcess: MAN.3 plan does NOT leak into SUP.1", () => {
  const sup1 = { id: "SUP.1", category: "SUP", inputWorkProducts: [], outputWorkProducts: [] };
  const artifacts = [
    { name: "2026년 템플릿/BSD_MAN3_Project_Plan.docx", wpidCandidates: [] },
    { name: "2026년 템플릿/BSD_SUP1_QA_계획서.docx", wpidCandidates: [] },
    { name: "2026년 템플릿/BSD_SUP1_QA_보고서.docx", wpidCandidates: [] },
  ];
  const scoped = scopeArtifactsForProcess(sup1, artifacts, { strict: true });
  const names = scoped.map((a) => a.name);
  assert.ok(!names.some((n) => /MAN3/.test(n)), `MAN.3 plan must be excluded, got ${names.join(", ")}`);
  assert.equal(scoped.length, 2, "SUP.1 keeps only its own plan + report");
});

test("scopeArtifactsForProcess: engineering keeps spec/design/report, drops MAN.3 plan", () => {
  const swe1 = { id: "SWE.1", category: "SWE", inputWorkProducts: [], outputWorkProducts: [] };
  const artifacts = [
    { name: "BSD_MAN3_Project_Plan.docx", wpidCandidates: [] },
    { name: "BSD_SWE1_Requirements_명세서.docx", wpidCandidates: [] },
    { name: "BSD_SWE1_Design_설계서.docx", wpidCandidates: [] },
  ];
  const scoped = scopeArtifactsForProcess(swe1, artifacts, { strict: true });
  const names = scoped.map((a) => a.name);
  assert.ok(!names.some((n) => /MAN3/.test(n)), "MAN.3 plan excluded from SWE.1");
  assert.equal(scoped.length, 2);
});

test("scopeArtifactsForProcess: strict mode does not back-fill with another process's deliverable", () => {
  const sup9 = { id: "SUP.9", category: "SUP", inputWorkProducts: [], outputWorkProducts: [] };
  // Only a MAN.3-owned plan is present; SUP.9 has nothing of its own.
  const artifacts = [{ name: "BSD_MAN3_Project_Plan.docx", wpidCandidates: [] }];
  const scoped = scopeArtifactsForProcess(sup9, artifacts, { strict: true });
  assert.equal(scoped.length, 0, "no own artifact → empty, never inherits MAN.3 plan");
});

test("scopeArtifactsForProcess: non-strict keeps legacy full fallback", () => {
  const sup9 = { id: "SUP.9", category: "SUP", inputWorkProducts: [], outputWorkProducts: [] };
  const artifacts = [{ name: "ad-hoc-notes.txt", wpidCandidates: [] }];
  const scoped = scopeArtifactsForProcess(sup9, artifacts, { strict: false });
  assert.equal(scoped.length, 1, "single-process mode still scores ad-hoc uploads");
});

test("scopeArtifactsForProcess: WP-id tag includes an artifact even without a name token", () => {
  const sup1 = {
    id: "SUP.1",
    category: "SUP",
    inputWorkProducts: [],
    outputWorkProducts: [{ id: "18-07", name: "Quality criteria" }],
  };
  // 'report' type so the SUP doc-type gate passes; tagged with a SUP.1 output WP.
  const artifacts = [{ name: "quality_report.docx", wpidCandidates: ["18-07"] }];
  const scoped = scopeArtifactsForProcess(sup1, artifacts, { strict: true });
  assert.equal(scoped.length, 1);
});
