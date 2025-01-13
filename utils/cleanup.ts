import Bet from '../models/bet.schema';
import Poll from '../models/poll.schema';

/**
 * Deletes the first 200 bets from the database based on ObjectId ordering
 * (ObjectIds contain a timestamp in their first 4 bytes, so they are naturally ordered by creation time)
 * @returns {Promise<{deletedBets: number, deletedPolls: number, firstId: string, lastId: string}>} Number of bets and polls deleted, and ID range of deleted bets
 */
export async function deleteFirst200Bets() {
    try {
        // Find the first 200 bets by sorting on _id
        // This works because ObjectIds contain a timestamp and are created sequentially
        const betsToDelete = await Bet.find({})
            .sort({ _id: 1 }) // Sort by ObjectId which includes creation timestamp
            .limit(200)
            .select('_id');

        if (betsToDelete.length === 0) {
            console.log('No bets found to delete');
            return {
                deletedBets: 0,
                deletedPolls: 0,
                firstId: null,
                lastId: null
            };
        }

        const betIds = betsToDelete.map(bet => bet._id);

        // Delete associated polls first
        const deletedPolls = await Poll.deleteMany({
            betId: { $in: betIds }
        });

        // Delete the bets
        const deletedBets = await Bet.deleteMany({
            _id: { $in: betIds }
        });

        console.log(`Deleted ${deletedBets.deletedCount} bets and ${deletedPolls.deletedCount} associated polls`);
        console.log('ID range deleted:', {
            firstId: betIds[0].toString(),
            lastId: betIds[betIds.length - 1].toString()
        });

        return {
            deletedBets: deletedBets.deletedCount,
            deletedPolls: deletedPolls.deletedCount,
            firstId: betIds[0].toString(),
            lastId: betIds[betIds.length - 1].toString()
        };
    } catch (error) {
        console.error('Error deleting bets:', error);
        throw error;
    }
}
