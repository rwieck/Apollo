package org.bbop.apollo.web.datastore;

import java.util.Collection;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;


/* Similar to AbstractDataStoreManager except no event firing,
 * also the AbstractDataStoreManager was a singleton, needed extra class to supplant functionality
 */
public class AbstractDeletedStoreManager {

    private static AbstractDeletedStoreManager instance;

    private Map<String, AbstractDataStore> trackToStore;

    public static AbstractDeletedStoreManager getInstance() {
        if (instance == null) {
            instance = new AbstractDeletedStoreManager();
        }
        return instance;
    }

    private AbstractDeletedStoreManager() {
        trackToStore = new ConcurrentHashMap<String, AbstractDataStore>();
    }

    public void addDeletedStore(String track, AbstractDataStore dataStore) {
        trackToStore.put(track, dataStore);
    }

    public AbstractDataStore getDeletedStore(String track) {
        return trackToStore.get(track);
    }

    public Collection<AbstractDataStore> getDeletedStores() {
        return trackToStore.values();
    }


    public void closeDeletedStore(String track) {
        AbstractDataStore store = getDeletedStore(track);
        if (store != null) {
            store.close();
            trackToStore.remove(track);
        }
    }

}
