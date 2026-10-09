import Joi from "joi";
import {
  AD_OFFER_TYPE,
  AD_RENTAL_DAYS_MAX,
  AD_SORT_FIELDS,
  AD_STATUS,
} from "../../constants/index.js";
import { ownUploadUrl } from "./uploadUrl.js";

/**
 * Срок проката.
 *
 * Для `rent` он обязателен: «отдам напрокат» без срока — обещание без условий,
 * и карточка с таким заголовком бесполезна. Для `sale` принимается `null`,
 * чтобы правка «прокат → продажа» могла снять срок тем же запросом.
 */
const rentalDays = Joi.alternatives().conditional("offer_type", {
  is: AD_OFFER_TYPE.RENT,
  then: Joi.number().integer().min(1).max(AD_RENTAL_DAYS_MAX).required().messages({
    "any.required": "Для проката нужен срок в днях",
    "number.min": "Срок проката — не меньше одного дня",
    "number.max": `Срок проката — не больше ${AD_RENTAL_DAYS_MAX} дней`,
  }),
  otherwise: Joi.number().integer().min(1).max(AD_RENTAL_DAYS_MAX).allow(null),
});

const offerType = Joi.string().valid(...Object.values(AD_OFFER_TYPE));

export const createAdSchema = Joi.object({
  user_id: Joi.number().integer().positive().required().messages({
    "number.base": "User ID must be a number",
    "number.integer": "User ID must be an integer",
    "number.positive": "User ID must be positive",
    "any.required": "User ID is required",
  }),

  title: Joi.string().min(3).max(200).trim().required().messages({
    "string.min": "Title must be at least 3 characters long",
    "string.max": "Title cannot exceed 200 characters",
    "any.required": "Title is required",
  }),

  content: Joi.string().min(10).max(5000).trim().required().messages({
    "string.min": "Content must be at least 10 characters long",
    "string.max": "Content cannot exceed 5000 characters",
    "any.required": "Content is required",
  }),

  category: Joi.number().integer().positive().required().messages({
    "number.base": "Category must be a number",
    "number.integer": "Category must be an integer",
    "number.positive": "Category must be positive",
    "any.required": "Category is required",
  }),

  subcategory: Joi.number().integer().positive().allow(null).messages({
    "number.base": "Subcategory must be a number",
    "number.integer": "Subcategory must be an integer",
    "number.positive": "Subcategory must be positive",
  }),

  price: Joi.alternatives()
    .try(Joi.number().positive(), Joi.string().trim())
    .allow("", null),

  offer_type: offerType.default(AD_OFFER_TYPE.SALE),
  rental_days: rentalDays,

  status: Joi.string()
    .valid(...Object.values(AD_STATUS))
    .default(AD_STATUS.ACTIVE),

  images: Joi.array()
    .items(
      Joi.object({
        // Свой каталог загрузок — см. uploadUrl.js: ссылка попадает в `src` карточки.
        url: ownUploadUrl().required(),
        is_main: Joi.boolean().default(false),
      })
    )
    .max(10)
    .default([]),

  isTelegram: Joi.boolean().default(false),

  selectedChats: Joi.array()
    .items(Joi.number().integer().positive())
    .default([]),
  // Внутренние id записей реестра `max_chats`, не chat_id чата.
  selectedMaxChats: Joi.array()
    .items(Joi.number().integer().positive())
    .default([]),
});

export const updateAdSchema = Joi.object({
  title: Joi.string().min(3).max(200).trim().optional(),
  content: Joi.string().min(10).max(5000).trim().optional(),
  category: Joi.number().integer().positive().optional(),
  subcategory: Joi.number().integer().positive().allow(null).optional(),
  price: Joi.alternatives()
    .try(Joi.number().positive(), Joi.string().trim())
    .allow("", null)
    .optional(),
  // Патч правки: тип предложения приходит только если автор его менял.
  // Дефолта здесь нет — иначе черновик без поля превращался бы в «продам».
  // `rental_days` без `.optional()`: он уже необязателен, а явная пометка
  // перебивает `required()` внутри условия и пропускала бы прокат без срока.
  offer_type: offerType.optional(),
  rental_days: rentalDays,
  status: Joi.string().valid(...Object.values(AD_STATUS)).optional(),
  images: Joi.array()
    .items(
      Joi.object({
        // Свой каталог загрузок — см. uploadUrl.js: ссылка попадает в `src` карточки.
        url: ownUploadUrl().required(),
        is_main: Joi.boolean().default(false),
      })
    )
    .max(10)
    .optional(),
  isTelegram: Joi.boolean().optional(),
  selectedChats: Joi.array()
    .items(Joi.number().integer().positive())
    .optional(),
  selectedMaxChats: Joi.array()
    .items(Joi.number().integer().positive())
    .optional(),
  telegramUpdateType: Joi.string()
    .valid("update_text", "update_media", "delete_and_repost")
    .optional(),
});

/**
 * Фильтры, одинаковые для обоих списков объявлений.
 *
 * Панель поиска на «Моих объявлениях» и на витрине одна, поэтому и набор
 * параметров у них один: раньше `priceMin`/`dateFrom` принимала только витрина,
 * и любой фильтр цены на своей странице отдавался 400 «priceMin is not
 * allowed».
 */
const adListFilters = {
  category: Joi.number().integer().positive(),
  subcategory: Joi.number().integer().positive(),
  search: Joi.string().trim().max(200),
  sort: Joi.string()
    .valid(...Object.values(AD_SORT_FIELDS))
    .default(AD_SORT_FIELDS.CREATED_AT),
  order: Joi.string().valid("ASC", "DESC").default("DESC"),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  priceMin: Joi.number().min(0),
  priceMax: Joi.number().min(0),
  dateFrom: Joi.date().iso(),
  dateTo: Joi.date().iso(),
};

export const getAdsQuerySchema = Joi.object({
  ...adListFilters,
  // «Только мой дом». Само число дома параметром не передаётся: сервер берёт его
  // из ролей смотрителя, иначе `?house=5` читал бы объявления чужого дома.
  onlyMyHouse: Joi.boolean(),
  // Витрина показывает активные; снятые и удалённые чужие объявления гостю
  // недоступны (контроллер не отдаёт другой статус без прав модерации).
  status: Joi.string()
    .valid(...Object.values(AD_STATUS))
    .default(AD_STATUS.ACTIVE),
});

/** `/:id` в маршрутах объявлений. */
export const adIdParamSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

/**
 * Список объявлений одного пользователя (`GET /api/ads/user/:user_id`).
 *
 * От витрины отличается одним: `status` без дефолта — без него приходят все
 * состояния, и страница делит их на вкладки, а счётчики берёт из `summary`.
 */
export const userAdsQuerySchema = Joi.object({
  ...adListFilters,
  status: Joi.string().valid(...Object.values(AD_STATUS)),
});

/** `/:user_id` в маршруте чужого списка объявлений. */
export const userAdsParamsSchema = Joi.object({
  user_id: Joi.number().integer().positive().required(),
});
