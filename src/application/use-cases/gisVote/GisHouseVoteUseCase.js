import { canViewHouse } from "../../../core/utils/roles.js";
import { buildGisVoteOverlay, titlesVotedByLabel } from "../../../core/utils/gisVoteOverlay.js";
import { GisVoteRepository } from "../../../infrastructure/repositories/GisVoteRepository.js";
import { HouseRepository } from "../../../infrastructure/repositories/HouseRepository.js";

/**
 * Подсветка проголосовавших на сетке квартир.
 *
 * Право то же, что у текста квартиры: `canViewHouse` — глобальная модерация и
 * держатели `house:<номер>:view|manage` (то есть старшие по дому). Остальным
 * сервер возвращает `null`, а не «скрыто, видно только администрации»: поля,
 * которого нет, в интерфейсе быть не может.
 *
 * Различия срезом по срезу тут нет: берётся последний по дате выгрузки, и его
 * название с датой едут в ответе, чтобы подпись «по срезу …» читалась честно.
 */
export class GisHouseVoteUseCase {
  constructor({
    reports = new GisVoteRepository(),
    houses = new HouseRepository(),
  } = {}) {
    this.reports = reports;
    this.houses = houses;
  }

  async execute({ house, viewer = null }) {
    if (!canViewHouse(viewer, house)) return null;

    const slice = await this.reports.latestSliceByHouse(house);

    if (!slice) return null;

    // Те же квартиры, что риснет сетка: `position = 1` — первые из совладельцев.
    const [apartments, votedRooms] = await Promise.all([
      this.houses.findByFilters({ house }),
      this.reports.votedRoomsByHouse(house),
    ]);

    return buildGisVoteOverlay({
      report: slice,
      rooms: slice.rooms ?? [],
      votedTitles: titlesVotedByLabel(votedRooms),
      apartments: apartments.map((apartment) => ({
        id: apartment.id,
        number: apartment.number,
      })),
    });
  }
}
