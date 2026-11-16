// ==========================================
// TDtimer 公式数据统一管理文件
// ==========================================
// 数据结构：项目 -> 分类 -> 公式列表[名称, 公式]
// 后续加新项目，只需在这里增加键值对即可，网页会自动生成 UI

window.FormulaDB = {
    "3x3": {
        "OLL": [
            ["OLL 1", "R U R' U R U2 R'"], ["OLL 2", "R' U' R U' R' U2 R"],
            ["OLL 3", "F R U R' U' F'"], ["OLL 4", "f R U R' U' f'"],
            ["OLL 5", "F' L' U' L U F"], ["OLL 6", "f' L' U' L U f"],
            ["OLL 7", "R U2 R' U' R U' R'"], ["OLL 8", "L' U2 L U L' U L"],
            ["OLL 9", "R2 D' R U2 R' D R U2 R"], ["OLL 10", "L2 D L' U2 L D' L' U2 L'"],
            ["OLL 11", "r U R' U' r' F R F'"], ["OLL 12", "l' U' L U l F' L' F"],
            ["OLL 13", "F R U R' U' F' f R U R' U' f'"], ["OLL 14", "f' L' U' L U f F' L' U' L U F"],
            ["OLL 15", "r' U' l L' U' L U l' U l"], ["OLL 16", "r U r' R U R' U' r U' r'"],
            ["OLL 17", "U2 R U R' U R' F R F' U2 R' F R F'"], ["OLL 18", "U2 F U R U2 R' S' R U R' S F'"],
            ["OLL 19", "r' R U R U R' U' M' R' F R F'"], ["OLL 20", "r U R' U' M2 U R U' R' U' M'"],
            ["OLL 21", "R U2 R2 U' R2 U' R2 U2 R"], ["OLL 22", "L' U2 L2 U L2 U L2 U2 L'"],
            ["OLL 23", "U2 R2 D' R U2 R' D R U2 R"], ["OLL 24", "R' F' r U R U' r' F"],
            ["OLL 25", "F R' F' r U R U' r'"], ["OLL 26", "R' U' R U' R' U2 R"],
            ["OLL 27", "R' U2 R U R' U R"], ["OLL 28", "r U R' U' r' R U R U' R'"],
            ["OLL 29", "S' R U R' U' R' F R F' U S"], ["OLL 30", "U' F U R U2 R' U' R U2 R' U' F'"],
            ["OLL 31", "U F R' F' R U R U R' U' R U' R'"], ["OLL 32", "S R U R' U' R' F R f'"],
            ["OLL 33", "R U R' U' R' F R F'"], ["OLL 34", "U R U R2 U' R' F R U R U' F'"],
            ["OLL 35", "F R U R' U' F' U F R U R' U' F'"], ["OLL 36", "F' L' U' L U F U' F' L' U' L U F"],
            ["OLL 37", "F R U' R' U' R U R' F'"], ["OLL 38", "R U R' U R U' R' U' R' F R F'"],
            ["OLL 39", "L F' L' U' L U F U' L'"], ["OLL 40", "R' F R U R' U' F' U R"],
            ["OLL 41", "S U' R' F' U' F U R S'"], ["OLL 42", "S' F R U R' U' F' U S"],
            ["OLL 43", "U R' F U R U' R2 F' R2 U R' U' R"], ["OLL 44", "U2 F U R U' R' F'"],
            ["OLL 45", "F U R U' R' F'"], ["OLL 46", "F' U' L' U L F"],
            ["OLL 47", "U' F R' F' R U2 R U' R' U R U2 R'"], ["OLL 48", "F R U R' U' R U R' U' F'"],
            ["OLL 49", "U2 r U' r2 U r2 U r2 U' r"], ["OLL 50", "U2 r' U r2 U' r2 U' r2 U r'"],
            ["OLL 51", "U2 F U R U' R' U R U' R' F'"], ["OLL 52", "R' U' R U' R' U F' U F R"],
            ["OLL 53", "U' r' U2 R U R' U' R U R' U r"], ["OLL 54", "U' r U r' R U R' U' R U R' U' r U' r'"],
            ["OLL 55", "U R' F U R U' R2 F' R2 U R' U' R"], ["OLL 56", "r' U' r U' R' U R U' R' U R r' U r"],
            ["OLL 57", "U R U R' U' M' U R U' r'"]
        ],
        "PLL": [
            ["Ua Perm", "R U' R U R U R U' R' U' R2"], ["Ub Perm", "R2 U R U R' U' R' U' R' U R'"],
            ["Z Perm", "M2 U M2 U M' U2 M2 U2 M'"], ["H Perm", "M2 U M2 U2 M2 U M2"],
            ["T Perm", "R U R' U' R' F R2 U' R' U' R U R' F'"], ["Y Perm", "F R U' R' U' R U R' F' R U R' U' R' F R F'"],
            ["Ja Perm", "R' U L' U2 R U' R' U2 R L U'"], ["Jb Perm", "R U R' F' R U R' U' R' F R2 U' R'"],
            ["Ga Perm", "R2 u R' U R' U' R u' R2 y' R' U R"], ["Gb Perm", "R' U' R y R2 u R' U R U' R u' R2"],
            ["Gc Perm", "R2 u' R U' R U R' u R2 y R U' R'"], ["Gd Perm", "R U R' y' R2 u' R U' R' U R' u R2"],
            ["Aa Perm", "x' R2 D2 R' U' R D2 R' U R' x"], ["Ab Perm", "x R2 D2 R U R' D2 R U' R x'"],
            ["Ra Perm", "U R U' R' U' R U R D R' U' R D' R' U2 R'"], ["Rb Perm", "R' U2 R U2 R' F R U R' U' R' F' R2"],
            ["V Perm", "R' U R' U' R D' R' D R' U D' R2 U' R2 D R2"], ["Na Perm", "R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'"],
            ["Nb Perm", "R' U R U' R' F' U' F R U R' F R' F' R U' R"], ["E Perm", "x' R U' R' D R U R' D' R U R' D R U' R' D' x"],
            ["F Perm", "R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R"]
        ]
    },
    "2x2": {
        "OLL": [
            ["OLL 1 (Sune)", "R U R' U R U2 R'"], ["OLL 2 (Anti-Sune)", "R' U' R U' R' U2 R"],
            ["OLL 3 (Pi)", "R2 U2 R U2 R2"], ["OLL 4 (Headlights)", "F R U R' U' F'"],
            ["OLL 5 (T)", "R U R' U' R' F R F'"], ["OLL 6 (U)", "F R U R' U' R U R' U' F'"],
            ["OLL 7 (L)", "F' R U R' U' R' F R"]
        ],
        "PBL": [
            ["Adj (邻角)", "R U2 R' U' R U2 R' F R' F' R U'"],
            ["Adj Adj (双邻角)", "R2 U F2 U2 R2 U R2"],
            ["Adj Opp (邻对)", "R' F R' F2 R U' R U2"],
            ["Opp (对角)", "F R' F' R U R U' R' F R F' R U R' U' R'"],
            ["Opp Adj (对邻)", "R2 U R2 U' R2 U R2 U' R2"],
            ["Opp Opp (双对角)", "R2 F2 R2"]
        ],
        "CLL": [
            ["CLL 1 (Sune)", "R U R' U R U2 R'"], ["CLL 2 (Anti-Sune)", "R U2 R' U' R U' R'"],
            ["CLL 3 (H)", "R U R' U R U' R' U R U2 R'"], ["CLL 4 (Pi)", "R U2 R2 U' R2 U' R2 U2 R"],
            ["CLL 5 (T)", "R U R' U' R' F R F'"], ["CLL 6 (U)", "F R U R' U' R U R' U' F'"],
            ["CLL 7 (L)", "F R' F' r U R U' r'"]
        ],
        "EG1": [
            ["EG1 AS 1", "U2 B U' R2 F2 U' F"], ["EG1 AS 2", "U R U' R' F' U' F2 R U' R'"],
            ["EG1 AS 3", "F' R U R' U' R U R2 F' R"], ["EG1 AS 4", "R' U' R' F2 R2 F' R U' R"],
            ["EG1 AS 5", "R U' R U R2 F' R F R"], ["EG1 AS 6", "R2 U' B2 U2 R2 U' R2"],
            ["EG1 H 1", "U R2 U' R2 F2 R2"], ["EG1 H 2", "R2 F2 R2 U2 R2"],
            ["EG1 H 3", "R2 U R2 U2 F2 U' R2"], ["EG1 H 4", "R2 U2 R2 F2 R2"],
            ["EG1 H 5", "F R2 U' R2 F2 R2"], ["EG1 H 6", "U2 F2 U2 R2 U2 F2"],
            ["EG1 L 1", "R2 U' R U' R' U R' U' R U' R2"], ["EG1 L 2", "U2 R U2 R' F2 R U' R'"],
            ["EG1 L 3", "R U R' U' R' F R F' R U R'"], ["EG1 L 4", "F R U R' U' F' R U R'"],
            ["EG1 L 5", "U F' R U R' U' R' F R"], ["EG1 L 6", "R' F R U R' U' F' R"],
            ["EG1 Pi 1", "R U2 R' U' R U R' U' R U' R'"], ["EG1 Pi 2", "R U2 R2 U' R2 U' R2 U2 R"],
            ["EG1 Pi 3", "F R U R' U' R U R' U' F'"], ["EG1 Pi 4", "U2 R U R' U R U' R' U R U2 R'"],
            ["EG1 Pi 5", "R' U' R U' R' U2 R"], ["EG1 Pi 6", "R U R' U R U2 R'"],
            ["EG1 S 1", "R U R' U R U2 R'"], ["EG1 S 2", "R U2 R' U' R U' R'"],
            ["EG1 S 3", "R' U' R U' R' U2 R"], ["EG1 S 4", "R' U2 R U R' U R"],
            ["EG1 S 5", "U2 R U R' U R U2 R'"], ["EG1 S 6", "U2 R' U' R U' R' U2 R"],
            ["EG1 T 1", "R U R' U' R' F R F'"], ["EG1 T 2", "F R U R' U' F'"],
            ["EG1 T 3", "R U R' U' R' F R F' R U R'"], ["EG1 T 4", "F R U R' U' F' R U R'"],
            ["EG1 T 5", "R' F R U R' U' F' R"], ["EG1 T 6", "F' R U R' U' R' F R"],
            ["EG1 U 1", "R2 U' R U' R' U R' U' R U' R2"], ["EG1 U 2", "R2 U R' U R U' R' U R U R2"],
            ["EG1 U 3", "R U R' U' R' F R2 U' R' U' R U R' F'"], ["EG1 U 4", "F R U' R' U' R U R' F' R U R' U' R' F R F'"]
        ],
        "EG2": [
            ["EG2 AS 1", "R U R' U R U2 R B2 R2"],
            ["EG2 AS 2", "R' F U R' F R2 U R' U' R F' R'"],
            ["EG2 AS 3", "U R' U2 F R' U R' F R2 F' R2 F' R U' R"],
            ["EG2 AS 4", "F U' R2 U' R' U2 R U' R2 F' R U' R'"],
            ["EG2 AS 5", "F2 R2 F' R' F' R F' R F2 U' R' F U' R' U' R'"],
            ["EG2 AS 6", "R' U' R U' R' U2 R' F2 R2 F' U' R' U R' U2 F R2"],
            ["EG2 H 1", "R2 B2 R2"], ["EG2 H 2", "R2 F2 R2"],
            ["EG2 H 3", "R2 U2 R2 U2 R2"], ["EG2 H 4", "F2 R2 U2 R2 F2"],
            ["EG2 H 5", "R2 U2 R2 U2 F2 R2"],
            ["EG2 L 1", "R' U R' F R2 U2 R' F' R U' R'"],
            ["EG2 L 2", "R' U R' F U' R U' R U2 R2 F R U R' U' F"],
            ["EG2 L 3", "R2 F2 R' F' U' R U2 R' U F R F R U' R U' R"],
            ["EG2 L 4", "U2 R2 U F' R U' R2 U' F2 R' U2 R' F R U2 R F2 R2 U' R U' R'"],
            ["EG2 L 5", "R U R F2 R2 U' R U2 R' F U' R2 F' R2 F' R U2 R"],
            ["EG2 Pi 1", "R U2 R2 F2 R2 F' R U' R'"], ["EG2 Pi 2", "F R2 U' R2 U' R2 U2 F'"],
            ["EG2 Pi 3", "R2 U2 R2 U' R2 U' R2"], ["EG2 Pi 4", "R U2 R' U' R U' R2 U2 R F2 R2"],
            ["EG2 Pi 5", "R' F R2 U' R2 F2 R"],
            ["EG2 S 1", "R U R' U R U2 R'"], ["EG2 S 2", "R U2 R' U' R U' R'"],
            ["EG2 S 3", "R' U' R U' R' U2 R"], ["EG2 S 4", "R' U2 R U R' U R"],
            ["EG2 S 5", "U2 R U R' U R U2 R'"], ["EG2 S 6", "U2 R' U' R U' R' U2 R"],
            ["EG2 T 1", "R U R' U' R' F R F'"], ["EG2 T 2", "F R U R' U' F'"],
            ["EG2 T 3", "R U R' U' R' F R F' R U R'"], ["EG2 T 4", "F R U R' U' F' R U R'"],
            ["EG2 T 5", "R' F R U R' U' F' R"], ["EG2 T 6", "F' R U R' U' R' F R"],
            ["EG2 U 1", "R2 U' R U' R' U R' U' R U' R2"], ["EG2 U 2", "R2 U R' U R U' R' U R U R2"],
            ["EG2 U 3", "R U R' U' R' F R2 U' R' U' R U R' F'"], ["EG2 U 4", "F R U' R' U' R U R' F' R U R' U' R' F R F'"]
        ]
    }
};
