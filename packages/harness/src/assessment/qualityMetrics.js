// 정량 품질 지표. 심사자가 확정한 참조 집합(reviewerConfirmed === true)이 있을 때만 계산한다.
// 테스트 통과율은 평가 정확도가 아니므로 여기서 다루지 않는다. 분모와 판정 단위를 결과에 함께 돌려준다.

/**
 * @param {{reviewerConfirmed?: boolean, judgments: Array<{claimId: string, classification: string}>}} reference 심사자 확정 분류(VALID/PARTIALLY_VALID/FALSE_POSITIVE/UNDETERMINED)
 * @param {Array<{claimId: string, disposition: "ACCEPTED"|"MODIFIED"|"REJECTED"|"DEFERRED"}>} engineOutput 엔진(또는 이번 파이프라인)이 각 지적에 내린 처분
 */
export function computeQualityMetrics(reference, engineOutput) {
  if (!reference?.reviewerConfirmed) {
    return { status: "NOT_COMPUTABLE", reason: "심사자가 확정한 참조 집합이 없어 정량 정확도를 계산하지 않는다. 테스트 성공률을 정확도로 표현하지 않는다." };
  }
  const ref = new Map(reference.judgments.map((j) => [j.claimId, j.classification]));
  const rows = engineOutput.filter((o) => ref.has(o.claimId));
  const count = (pred) => rows.filter(pred).length;
  const falsePositives = rows.filter((o) => ref.get(o.claimId) === "FALSE_POSITIVE");
  const valid = rows.filter((o) => ref.get(o.claimId) === "VALID");
  const undetermined = rows.filter((o) => ref.get(o.claimId) === "UNDETERMINED");
  const ratio = (num, den, unit) => ({ numerator: num, denominator: den, unit, value: den ? num / den : null });
  return {
    status: "COMPUTED",
    // 오지적 기각률: 심사자가 오지적으로 확정한 지적 중 REJECTED/MODIFIED 처리한 비율
    falsePositiveRejection: ratio(falsePositives.filter((o) => o.disposition === "REJECTED").length, falsePositives.length, "심사자 확정 FALSE_POSITIVE 지적"),
    // 중요 결함 재현율: 심사자가 VALID 로 확정한 지적 중 ACCEPTED/MODIFIED 로 유지한 비율
    validRecall: ratio(valid.filter((o) => o.disposition === "ACCEPTED" || o.disposition === "MODIFIED").length, valid.length, "심사자 확정 VALID 지적"),
    // 탐지 정밀도: 유지(ACCEPTED/MODIFIED)한 지적 중 심사자가 VALID/PARTIALLY_VALID 로 확정한 비율
    precision: ratio(
      count((o) => (o.disposition === "ACCEPTED" || o.disposition === "MODIFIED") && ["VALID", "PARTIALLY_VALID"].includes(ref.get(o.claimId))),
      count((o) => o.disposition === "ACCEPTED" || o.disposition === "MODIFIED"),
      "엔진이 유지한 지적 (참조 집합에 있는 것만)"
    ),
    // 미확인 사항의 적절한 보류 비율
    appropriateDeferral: ratio(undetermined.filter((o) => o.disposition === "DEFERRED").length, undetermined.length, "심사자 확정 UNDETERMINED 지적"),
    scope: `참조 집합에 있는 지적 ${rows.length}건. 이 집합 밖과 다른 사례로 일반화하지 않는다.`,
  };
}
