"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paginationQuery = exports.uuidParam = exports.planillaValidation = exports.userUpdateValidation = exports.messageValidation = exports.commentValidation = exports.matchResultValidation = exports.matchUpdateValidation = exports.matchValidation = exports.betScoreValidation = exports.betValidation = exports.loginValidation = exports.registerValidation = exports.validate = void 0;
const express_validator_1 = require("express-validator");
const validate = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: errors.array()
        });
        return;
    }
    next();
};
exports.validate = validate;
exports.registerValidation = [
    (0, express_validator_1.body)('nombre').trim().notEmpty().withMessage('Nombre requerido').isLength({ min: 2, max: 100 }),
    (0, express_validator_1.body)('email').trim().isEmail().withMessage('Email inválido').normalizeEmail(),
    (0, express_validator_1.body)('password').isLength({ min: 8 }).withMessage('Password mínimo 8 caracteres'),
    (0, express_validator_1.body)('idioma_pref').optional().isIn(['es', 'pt-BR']),
    exports.validate,
];
exports.loginValidation = [
    (0, express_validator_1.body)('email').trim().isEmail().withMessage('Email inválido'),
    (0, express_validator_1.body)('password').notEmpty().withMessage('Password requerido'),
    exports.validate,
];
exports.betValidation = [
    (0, express_validator_1.body)('planilla_id').isUUID().withMessage('ID de planilla inválido'),
    (0, express_validator_1.body)('match_id').isUUID().withMessage('ID de match inválido'),
    (0, express_validator_1.body)('goles_local').isInt({ min: 0, max: 99 }).withMessage('Goles local debe ser 0-99'),
    (0, express_validator_1.body)('goles_visitante').isInt({ min: 0, max: 99 }).withMessage('Goles visitante debe ser 0-99'),
    exports.validate,
];
exports.betScoreValidation = [
    (0, express_validator_1.body)('planilla_id').isUUID().withMessage('ID de planilla inválido'),
    (0, express_validator_1.body)('match_id').isUUID().withMessage('ID de match inválido'),
    (0, express_validator_1.body)('score').trim().matches(/^\d+[-:]\d+$/).withMessage('Formato inválido. Usar X-Y (ej: 2-1)'),
    exports.validate,
];
exports.matchValidation = [
    (0, express_validator_1.body)('home_team').trim().notEmpty().withMessage('Equipo local requerido'),
    (0, express_validator_1.body)('away_team').trim().notEmpty().withMessage('Equipo visitante requerido'),
    (0, express_validator_1.body)('home_team_pt').optional().trim().isLength({ max: 100 }),
    (0, express_validator_1.body)('away_team_pt').optional().trim().isLength({ max: 100 }),
    (0, express_validator_1.body)('start_time').isISO8601().withMessage('Fecha/hora inválida'),
    (0, express_validator_1.body)('halftime_minutes').optional().isInt({ min: 0, max: 60 }),
    (0, express_validator_1.body)('time_cutoff').optional().isISO8601(),
    (0, express_validator_1.body)('tournament_id').optional().isUUID().withMessage('tournament_id debe ser UUID'),
    (0, express_validator_1.body)('planilla_id').optional().isUUID().withMessage('planilla_id debe ser UUID'),
    (0, express_validator_1.body)('grupo').optional().trim().isLength({ max: 50 }).withMessage('grupo máximo 50 caracteres'),
    (0, express_validator_1.body)('jornada').optional().trim().isLength({ max: 50 }).withMessage('jornada máximo 50 caracteres'),
    (0, express_validator_1.body)('sede').optional().trim().isLength({ max: 100 }).withMessage('sede máximo 100 caracteres'),
    exports.validate,
];
exports.matchUpdateValidation = [
    (0, express_validator_1.param)('id').isUUID().withMessage('ID de partido inválido'),
    (0, express_validator_1.body)('home_team').optional().trim().notEmpty().isLength({ max: 100 }),
    (0, express_validator_1.body)('away_team').optional().trim().notEmpty().isLength({ max: 100 }),
    (0, express_validator_1.body)('home_team_pt').optional().trim().isLength({ max: 100 }),
    (0, express_validator_1.body)('away_team_pt').optional().trim().isLength({ max: 100 }),
    (0, express_validator_1.body)('start_time').optional().isISO8601().withMessage('Fecha/hora inválida'),
    (0, express_validator_1.body)('halftime_minutes').optional().isInt({ min: 0, max: 60 }),
    (0, express_validator_1.body)('time_cutoff').optional().isISO8601(),
    (0, express_validator_1.body)('estado').optional().isIn(['scheduled', 'live', 'finished']).withMessage('estado inválido'),
    (0, express_validator_1.body)('finished').optional().isBoolean(),
    (0, express_validator_1.body)('tournament_id').optional().isUUID().withMessage('tournament_id debe ser UUID'),
    (0, express_validator_1.body)('grupo').optional().trim().isLength({ max: 50 }),
    (0, express_validator_1.body)('jornada').optional().trim().isLength({ max: 50 }),
    (0, express_validator_1.body)('sede').optional().trim().isLength({ max: 100 }),
    exports.validate,
];
exports.matchResultValidation = [
    (0, express_validator_1.param)('matchId').isUUID().withMessage('ID de match inválido'),
    (0, express_validator_1.body)('resultado_local').isInt({ min: 0, max: 99 }).withMessage('Resultado local inválido'),
    (0, express_validator_1.body)('resultado_visitante').isInt({ min: 0, max: 99 }).withMessage('Resultado visitante inválido'),
    exports.validate,
];
exports.commentValidation = [
    (0, express_validator_1.body)('target_type').isIn(['ranking', 'match', 'planilla']).withMessage('Tipo de target inválido'),
    (0, express_validator_1.body)('target_id').isUUID().withMessage('ID de target inválido'),
    (0, express_validator_1.body)('content').trim().isLength({ min: 1, max: 280 }).withMessage('Contenido 1-280 caracteres'),
    (0, express_validator_1.body)('parent_id').optional().isUUID(),
    exports.validate,
];
exports.messageValidation = [
    (0, express_validator_1.param)('otherUserId').isUUID().withMessage('ID de usuario inválido'),
    (0, express_validator_1.body)('content').trim().notEmpty().withMessage('Mensaje requerido').isLength({ max: 1000 }).withMessage('Mensaje máximo 1000 caracteres'),
    exports.validate,
];
exports.userUpdateValidation = [
    (0, express_validator_1.body)('nombre').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Nombre debe tener entre 2 y 100 caracteres'),
    (0, express_validator_1.body)('idioma_pref').optional().isIn(['es', 'pt-BR']).withMessage('Idioma debe ser "es" o "pt-BR"'),
    (0, express_validator_1.body)('whatsapp_consent').optional().isBoolean().withMessage('whatsapp_consent debe ser booleano'),
    exports.validate,
];
exports.planillaValidation = [
    (0, express_validator_1.body)('nombre_planilla').trim().isLength({ min: 1, max: 100 }).withMessage('Nombre requerido (1-100 chars)'),
    exports.validate,
];
exports.uuidParam = [
    (0, express_validator_1.param)('id').matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).withMessage('ID inválido'),
    exports.validate,
];
exports.paginationQuery = [
    (0, express_validator_1.query)('page').optional().isInt({ min: 1 }).toInt(),
    (0, express_validator_1.query)('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    exports.validate,
];
//# sourceMappingURL=validation.js.map