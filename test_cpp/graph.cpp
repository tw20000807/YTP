#include<iostream>
#include<vector>
using namespace std;

int main(){
    int N = 5;
    {
        // graph
        vector<vector<int>> adjcent_matrix(N,vector<int>(N,0));
        vector<vector<int>> adjcent_list(N);
        vector<int> next(N);
        // tree
        vector<int> p{-1,0,0,1,1};
        vector<vector<int>> child{{1,2},{},{3,4},{},{}};
        for(int i = 0;i < N;i++) next[i] = (i+1)%N;
        for(int i = 0;i < N;i++){
            for(int j = 0;j < N;j++){
                if(i < j){
                    adjcent_list[i].push_back(j);
                    adjcent_matrix[i][j] = true;
                }
            }
        }
        cout << next[1] << "\n";
    }

    cout << N << '\n';
}
