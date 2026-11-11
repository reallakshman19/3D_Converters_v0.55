# Legacy BS5500 flange workbook — formula-level recovery

Source: `docs/flange/flange design to BS5500.xls`

Programme: `ENGCALC-BOLTED-JOINTS` / issue #721 P4

Authority: `LEGACY_BENCHMARK_ONLY`

## Recovery method

The source is a BIFF8 `.xls` compound document. Formula records were recovered directly from the workbook stream and decoded from their stored RPN token sequences. Cell references were preserved as stored; no engineering equation was substituted from memory.

As a decoder cross-check, all 50 recovered formula token streams were replayed against the workbook's stored input/cached cell values. The replay reproduced all 50 cached formula results within relative tolerance `1e-12`.

```text
formula records recovered    50
formula records replayed     50
cached-result matches        50
cached-result mismatches      0
```

This validates the workbook formula recovery. It does **not** validate BS5500/PD5500 Code correctness, current applicability, material allowables, or design authority.

## Principal source fixture

Recoverable labeled inputs/values in `Sheet1` include:

| Cell | Workbook label / role | Stored value |
|---|---|---:|
| `M3` | Design Pressure P | 0.2 N/mm² |
| `M5` | Design Temperature | 50 °C |
| `M7` | Flange Material | `grade 28A` |
| `M9` | Hub/Shell Material | `grade 28A` |
| `M11` | Gasket Type | `spiral wound` |
| `M13` | Bolting Material | `B7` |
| `C14` | flange thickness `t` | 44 mm |
| `I3` | `go` | 10 mm |
| `I9` | `g1` | 10 mm |
| `I15` | `B` | 1046 mm |
| `I23` | `C` | 1210 mm |
| `I25` | `A` | 1290 mm |
| `A21` | number of bolts | 28 |
| `C21` | bolt diameter | 39 mm |
| `Q44` | single bolt root area | 979.75 mm² |
| `N23` | bolt operating stress `Sb` | 172 N/mm² |
| `P23` | bolt ambient stress `Sa` | 172 N/mm² |
| `N27` | gasket contact-face o.d. | 1162 mm |
| `P27` | gasket contact-face i.d. | 1046 mm |
| `P31` | gasket `m` | 1.4 |
| `P33` | gasket `y` | 13 N/mm² |
| `X27` | shape constant `F` | 0.90892 |
| `X29` | shape constant `V` | 0.550103 |
| `X31` | shape/stress constant `f` | 1.0 |
| `U18` | applied operating moment | 0 N·mm |

## Recovered formulas

The expressions below are a direct readable rendering of the stored formula-token programs.

| Cell | Recovered expression | Workbook cached result |
|---|---|---:|
| `U5` | `((0.785*(I15^2))*M3)` | `171776.21200000003` |
| `Y5` | `((((I23-I15)-I9))/2)` | `77.0` |
| `U7` | `Q38` | `27080.646788052883` |
| `Y7` | `(((I23-I21))/2)` | `37.57061531397892` |
| `U9` | `(M38-U5)` | `30424.78294803828` |
| `Y9` | `(((((2*I23)-I15)-I21))/4)` | `59.78530765698946` |
| `U11` | `(U5*Y5)` | `13226768.324000003` |
| `U13` | `(U7*Y7)` | `1017436.5629276737` |
| `U15` | `(U9*Y9)` | `1818955.0089455952` |
| `U17` | `((U11+U13)+U15)` | `16063159.895873273` |
| `Y17` | `(M48*Y7)` | `100447554.86610292` |
| `U19` | `(U17+U18)` | `16063159.895873273` |
| `I21` | `M33` | `1134.8587693720422` |
| `U23` | `SQRT((I15*I3))` | `102.27414140436477` |
| `X23` | `(C9/U23)` | `0.0` |
| `U25` | `(I25/I15)` | `1.2332695984703632` |
| `X25` | `(I9/I3)` | `1.0` |
| `U27` | `(((((U25^2)*((1+((8.55246*LOG10(U25))))))-1))/((((1.0472+(1.9448*(U25^2))))*((U25-1)))))` | `1.8253921302604372` |
| `M29` | `(((N27-P27))/2)` | `58.0` |
| `P29` | `(M29/2)` | `29.0` |
| `U29` | `(((((U25^2)*((1+((8.55246*LOG10(U25))))))-1))/(((1.36136*(((U25^2)-1)))*((U25-1)))))` | `10.308673928365396` |
| `M31` | `IF((M11="ring joint"),(M29/8),MIN(P29,(2.52*SQRT(P29))))` | `13.57061531397895` |
| `U31` | `(((0.66845+((5.7169*(((U25^2)*LOG10(U25))))/(((U25^2)-1)))))/((U25-1)))` | `9.380913777978774` |
| `M33` | `(N27-(2*M31))` | `1134.8587693720422` |
| `U33` | `((((U25^2)+1))/(((U25^2)-1)))` | `4.839111273298902` |
| `X33` | `(X27/U23)` | `0.008887094895339887` |
| `U35` | `((((U29/X29))*U23)*(I3^2))` | `191656.97606468806` |
| `M38` | `((0.785*(M33^2))*M3)` | `202200.9949480383` |
| `Q38` | `((((6.28*M31)*M33)*P31)*M3)` | `27080.646788052883` |
| `W38` | `MAX(1,SQRT(((((3.14*I23)/A21))/(((2*C21)+((6*C14)/((P31+0.5))))))))` | `1.0` |
| `M40` | `(M38+Q38)` | `229281.6417360912` |
| `Q40` | `(((3.14*M31)*M33)*P33)` | `628657.8718655134` |
| `U40` | `C14` | `44.0` |
| `M42` | `(M40/N23)` | `1333.0328007912278` |
| `Q42` | `(Q40/P23)` | `3654.987627125078` |
| `U42` | `((((4/3)*C14)*X33)+1)` | `1.52137623385994` |
| `M44` | `MAX(M42,Q42)` | `3654.987627125078` |
| `U44` | `(((((C14*X33)+1))/U27)+((C14^3)/U35))` | `1.2065064062029802` |
| `M46` | `(A21*Q44)` | `27433.0` |
| `M48` | `((((M46+M44))*P23)/2)` | `2673566.9359327564` |
| `T49` | `IF((U19=""),((U17*W38)/I15),((U19*W38)/I15))` | `15356.749422440987` |
| `V49` | `IF((W38>1),((Y17*W38)/I15),(Y17/I15))` | `96030.16717600661` |
| `V54` | `((X31*T49)/((U44*(I9^2))))` | `127.28278394120187` |
| `X54` | `((X31*V49)/((U44*(I9^2))))` | `795.9358249760564` |
| `V56` | `((U42*T49)/((U44*(C14^2))))` | `10.002324507627797` |
| `X56` | `((U42*V49)/((U44*(C14^2))))` | `62.54740949360935` |
| `V58` | `(((T49*U31)/(C14^2))-(U33*V56))` | `26.008972518601595` |
| `X58` | `(((V49*U31)/(C14^2))-(U33*X56))` | `162.6415793037317` |
| `V60` | `(0.5*((V54+MAX(V56,V58))))` | `76.64587822990174` |
| `X60` | `(0.5*((X54+MAX(X56,X58))))` | `479.2887021398941` |

## Interpretation boundary

The recovery materially changes the P4 source-admission state: the workbook equations can now be reproduced as a legacy benchmark without guessing missing formula symbols.

It does **not** establish the governing standard basis. In particular:

- the workbook uses literal approximations such as `0.785`, `3.14`, `6.28` and workbook-specific shape-constant expressions;
- exact BS5500 edition/amendment, clause/table/figure identity and current applicability remain unresolved;
- stored material/gasket/bolt values remain fixture data, not master authority;
- the workbook's own acceptance statements remain non-authorizing.

Therefore:

```text
P4_LEGACY_FORMULA_RECOVERY       PASS_50_OF_50
P4_LEGACY_BENCHMARK_ADMISSION    ALLOWED
P4_CODE_DESIGN_AUTHORITY         BLOCKED_CONTROLLED_SOURCE
```

The next permissible implementation is a separately named, fail-closed `LEGACY_BENCHMARK_ONLY` kernel with the workbook fixture used as a regression oracle. It must not be registered as a governing calculation or presented as Code compliance.